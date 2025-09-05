import os
import logging

import click
import dotenv
import httpx
import sqlmodel

from sqlmodel import SQLModel, Session, create_engine

import API

from models import Categories, Resources, ResourceFiles

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

dotenv.load_dotenv("../../.env")

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

if __name__ == "__main__":
    cli()