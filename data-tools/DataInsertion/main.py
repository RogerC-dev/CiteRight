import asyncio
import os
import logging
import json

from pathlib import Path

import click
import dotenv
import httpx
import sqlmodel

from sqlmodel import SQLModel, Session, create_engine

import API

from models import Categories, Resources, ResourceFiles
from models.law import Law, LawAttachment, LawArticle, LawCaption

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_insertion.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

dotenv.load_dotenv(".env")

database_url = os.getenv("DATABASE_URL")

logger.info(f"Using connection string: {database_url}")

engine = create_engine(
    database_url, 
    echo=True,
    pool_pre_ping=True,
)
def recreate_tables():
    """Force drop and recreate all tables."""
    logger.info("Dropping and recreating all tables...")
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    logger.info("Tables recreated successfully.")

def update_category():
    with httpx.Client() as client, Session(engine) as session:
        try:
            response = client.get(API.JUDICIAL_CATEGORYS_API)
            response.raise_for_status()
            categories_data = response.json()
        except httpx.RequestError as e:
            logger.error(f"Error fetching categories: {e}")
            return

        for category in categories_data:
            category_no = category.get("categoryNo")
            category_name = category.get("categoryName")

            if not category_no or not category_name:
                logger.warning(f"Skipping invalid category data: {category}")
                continue

            existing_category = session.get(Categories, category_no)
            if existing_category:
                existing_category.category_name = category_name
                logger.info(f"Updated category: {category_no} - {category_name}")
            else:
                new_category = Categories(
                    category_no=category_no,
                    category_name=category_name
                )
                session.add(new_category)
                logger.info(f"Added new category: {category_no} - {category_name}")

        session.commit()
        logger.info("Category update completed.")

def update_resources():
    with httpx.Client() as client, Session(engine) as session:
        categories = session.exec(sqlmodel.select(Categories)).all()
        for category in categories:
            try:
                response = client.get(API.JUDICIAL_CATEGORY_RESOURCES_API.format(categoryNo=category.category_no))
                response.raise_for_status()
                resources_data = response.json()
            except httpx.RequestError as e:
                logger.error(f"Error fetching resources for category {category.category_no}: {e}")
                continue

            for resource in resources_data:
                dataset_id = resource.get("datasetId")
                title = resource.get("title")

                if not dataset_id or not title:
                    logger.warning(f"Skipping invalid resource data: {resource}")
                    continue

                existing_resource = session.get(Resources, dataset_id)
                if existing_resource:
                    existing_resource.title = title
                    logger.info(f"Updated resource: {dataset_id} - {title}")
                else:
                    new_resource = Resources(
                        dataset_id=dataset_id,
                        category_no=category.category_no,
                        title=title
                    )
                    session.add(new_resource)
                    logger.info(f"Added new resource: {dataset_id} - {title}")

                for file_set in resource.get("filesets", []):
                    file_set_id = file_set.get("fileSetId")
                    resource_format = file_set.get("resourceFormat")
                    resource_description = file_set.get("resourceDescription")

                    if not file_set_id or not resource_format:
                        logger.warning(f"Skipping invalid file set data: {file_set}")
                        continue

                    existing_file = session.get(ResourceFiles, file_set_id)
                    if existing_file:
                        existing_file.resource_format = resource_format
                        existing_file.resource_description = resource_description
                        logger.info(f"Updated resource file: {file_set_id}")
                    else:
                        new_file = ResourceFiles(
                            dataset_id=dataset_id,
                            file_set_id=file_set_id,
                            resource_format=resource_format,
                            resource_description=resource_description
                        )
                        session.add(new_file)
                        logger.info(f"Added new resource file: {file_set_id}")
            session.commit()
        logger.info("Resource update completed.")

async def download_file(file: ResourceFiles):
    file_type = file.resource_format.lower()
    file_path = f"downloads/{file.resource.category.category_name}/{file.resource.title}/{file.resource_description}.{file_type}"
    if Path(file_path).exists():
        logger.info(f"File {file_path} already exists. Skipping download.")
        return
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(file.get_download_url())
            response.raise_for_status()
            with open(file_path, 'wb') as f:
                f.write(response.content)
            logger.info(f"Downloaded file {file.file_set_id} to {file_path}")
        except httpx.HTTPStatusError as e:
            logger.error(f"Error downloading file {file.file_set_id}: {e}")


@click.group()
def cli():
    """Data insertion tool for judicial data."""
    pass

@cli.command()
@click.option('--reset-database', is_flag=True, help='Drop and recreate all tables before updating')
def update_categories(reset_database):
    """Update categories from API."""
    if reset_database:
        recreate_tables()
    logger.info("Starting category update...")
    update_category()

@cli.command()
@click.option('--reset-database', is_flag=True, help='Drop and recreate all tables before updating')
def update_resources(reset_database):
    """Update resources from API."""
    if reset_database:
        recreate_tables()
    logger.info("Starting resource update...")
    update_resources()

@cli.command()
@click.option('--reset-database', is_flag=True, help='Drop and recreate all tables before syncing')
def sync_all(reset_database):
    """Update both categories and resources."""
    if reset_database:
        recreate_tables()
    logger.info("Starting full sync...")
    update_category()
    update_resources()

@cli.command()
def reset_tables():
    """Drop and recreate all database tables."""
    recreate_tables()

@cli.command()
@click.option('--category-no', prompt='Category number',
              help='The category number to download files for.')
def download_by_category_no(category_no):
    """Download resource files organized by category."""
    logger.info("Starting categorized file download...")
    with Session(engine) as session:
        category = session.exec(sqlmodel.select(Categories).where(Categories.category_no == category_no)).one_or_none()
        if not category:
            logger.error(f"Category {category_no} not found.")
            return
        category_dir = f"downloads/{category.category_name}/"
        os.makedirs(category_dir, exist_ok=True)
        for resource in category.resources:
            resource_dir = f"{category_dir}/{resource.title}/"
            os.makedirs(resource_dir, exist_ok=True)
            for file in resource.resource_files:
                asyncio.run(download_file(file))
    logger.info("Categorized file download completed.")

@cli.command()
def download_files():
    """Download all resource files."""
    logger.info("Starting file download...")
    with Session(engine) as session:
        files = session.exec(sqlmodel.select(ResourceFiles)).all()
        os.makedirs("downloads", exist_ok=True)
        for file in files:
            category_dir = f"downloads/{file.resource.category.category_name}/{file.resource.title}/"
            os.makedirs(category_dir, exist_ok=True)
            asyncio.run(download_file(file))
    logger.info("File download completed.")

@cli.command()
@click.option('--reset-database', default=False, is_flag=True, help='Drop and recreate all tables before inserting')
@click.argument("law_data_file", type=click.Path(exists=True))
def insert_law_data(reset_database, law_data_file):
    """Insert law data into the database."""
    if reset_database:
        recreate_tables()
    logger.info("Starting law data insertion...")
    with Session(engine) as session, open(law_data_file, 'r', encoding='utf-8-sig') as f:
        law_data = json.load(f)
        for law in law_data.get("Laws", []):
            law_has_eng_version = law.get("LawHasEngVersion", False)
            if isinstance(law_has_eng_version, str):
                law_has_eng_version = law_has_eng_version.upper() == 'Y'
            
            law_modified_date = law.get("LawModifiedDate")
            law_effective_date = law.get("LawEffectiveDate")
            law_model = Law(
                law_level=law.get("LawLevel"),
                law_name=law.get("LawName"),
                law_url=law.get("LawURL"),
                law_category=law.get("LawCategory"),
                law_modified_date=law_modified_date if law_modified_date else None,
                law_effective_date=law_effective_date if law_effective_date else None,
                law_effective_note=law.get("LawEffectiveNote"),
                law_abandon_note=law.get("LawAbandonNote"),
                law_histories=law.get("LawHistories"),
                law_has_eng_version=law_has_eng_version,
                eng_law_name=law.get("EngLawName"),
                law_foreword=law.get("LawForeword")
            )
            session.add(law_model)
            logger.info(f"Inserted law: {law_model.law_level} - {law_model.law_name}")
            session.flush()
            for attachment in law.get("LawAttachements", []):
                attachment_model = LawAttachment(
                    law_level=law_model.law_level,
                    law_name=law_model.law_name,
                    title=attachment.get("Title"),
                    file_url=attachment.get("FileURL")
                )
                session.add(attachment_model)
            
            last_caption: LawCaption = None
            for article in law.get("LawArticles", []):
                if article.get("ArticleType") == "C":
                    last_caption = LawCaption(
                        law_level=law_model.law_level,
                        law_name=law_model.law_name,
                        caption_title=article.get("ArticleContent")
                    )
                    session.add(last_caption)
                else:
                    if last_caption:
                        article_model = LawArticle(
                            caption_id=last_caption.id,
                            law_level=law_model.law_level,
                            law_name=law_model.law_name,
                            article_no=article.get("ArticleNo"),
                            article_content=article.get("ArticleContent")
                        )
                    else:
                        article_model = LawArticle(
                            law_level=law_model.law_level,
                            law_name=law_model.law_name,
                            article_no=article.get("ArticleNo"),
                            article_content=article.get("ArticleContent")
                        )
                    session.add(article_model)
        session.commit()

if __name__ == "__main__":
    cli()