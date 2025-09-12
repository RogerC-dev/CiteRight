import asyncio
import os
import logging
import json
from datetime import datetime

from pathlib import Path

import click
import dotenv
import httpx
import sqlmodel

from sqlmodel import SQLModel, Session, create_engine, delete

import API

from models import Categories, Resources, ResourceFiles
from models.law import Law, LawAttachment, LawArticle, LawCaption
from models.interpretations import Interpretations, InterpretationsEN, InterpretationsZH, InterpretationAdditions

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

def insert_interpretation_data(path: Path):
    
    # Prepare SQL output file
    sql_output_path = Path("interpretation_data.sql")
    sql_statements = []
    
    # Add clear existing data statements
    sql_statements.extend([
        "-- Clear existing interpretation data",
        "DELETE FROM interpretation_additions;",
        "DELETE FROM interpretations_en;", 
        "DELETE FROM interpretations_zh;",
        "DELETE FROM interpretations;",
        "",
        "-- Insert new interpretation data"
    ])
    
    with Session(engine) as session:
        for file in path.glob("**/*.json"):
            with open(file, 'r', encoding='utf-8') as f:
                data_wrapper = json.load(f)
                data = data_wrapper.get("data", {})
                
                # Parse interpretation date
                interpretation_date = data.get("inte_date")
                if interpretation_date:
                    interpretation_date = datetime.strptime(interpretation_date, "%Y/%m/%d 上午 12:00:00").date()
                
                # Generate SQL for main interpretation record
                inte_no = data.get("inte_no", "").replace("'", "''")
                source_url = data.get("data_url", "").replace("'", "''")
                order_val = data.get("inte_order", "").replace("'", "''")
                order_title = data.get("inte_order_title", "").replace("'", "''")
                order_change = data.get("inte_order_change", "").replace("'", "''")
                number_change = data.get("inte_no_chg", "").replace("'", "''")
                announcement_order = data.get("inte_announcement_order_en", "").replace("'", "''")
                amendment_order = data.get("inte_amendment_order_en", "").replace("'", "''")
                
                date_str = f"'{interpretation_date}'" if interpretation_date else "NULL"
                
                sql_statements.append(
                    f"INSERT INTO interpretations (interpretation_number, interpretation_date, source_url, `order`, order_title, order_change, number_change, announcement_order, amendment_order) "
                    f"VALUES ('{inte_no}', {date_str}, '{source_url}', '{order_val}', '{order_title}', '{order_change}', '{number_change}', '{announcement_order}', '{amendment_order}');"
                )
                
                # Generate SQL for Chinese version record
                def escape_sql(text):
                    if text is None:
                        return "NULL"
                    return f"'{text.replace(chr(39), chr(39)+chr(39))}'"
                
                number_title_zh = escape_sql(data.get("inte_no_title"))
                issue_zh = escape_sql(data.get("inte_issue"))
                description_zh = escape_sql(data.get("inte_desc"))
                reasoning_zh = escape_sql(data.get("inte_reason"))
                other_documents = escape_sql(data.get("other_doc"))
                kind_1 = escape_sql(data.get("inte_kind_1"))
                kind_2 = escape_sql(data.get("inte_kind_2"))
                fact_zh = escape_sql(data.get("inte_fact"))
                
                sql_statements.append(
                    f"INSERT INTO interpretations_zh (interpretation_number, number_title, issue, description, reasoning, other_documents, interpretation_kind_1, interpretation_kind_2, fact) "
                    f"VALUES ('{inte_no}', {number_title_zh}, {issue_zh}, {description_zh}, {reasoning_zh}, {other_documents}, {kind_1}, {kind_2}, {fact_zh});"
                )
                
                # Generate SQL for English version record if available
                if data.get("inte_no_title_en") or data.get("inte_issue_en"):
                    number_title_en = escape_sql(data.get("inte_no_title_en"))
                    issue_en = escape_sql(data.get("inte_issue_en"))
                    description_en = escape_sql(data.get("inte_desc_en"))
                    reasoning_en = escape_sql(data.get("inte_reason_en"))
                    fact_en = escape_sql(data.get("inte_fact_en"))
                    other_opinion = escape_sql(data.get("inte_opinions_en"))
                    constitutional_complaint = escape_sql(data.get("inte_constitutional_complaint_en"))
                    decision = escape_sql(data.get("inte_decision_en"))
                    regulations = escape_sql(data.get("inte_regulations_en"))
                    appendix = escape_sql(data.get("inte_appendix_en"))
                    
                    sql_statements.append(
                        f"INSERT INTO interpretations_en (interpretation_number, number_title, issue, description, reasoning, fact, other_opinion, constitutional_complaint, decision, regulations, appendix) "
                        f"VALUES ('{inte_no}', {number_title_en}, {issue_en}, {description_en}, {reasoning_en}, {fact_en}, {other_opinion}, {constitutional_complaint}, {decision}, {regulations}, {appendix});"
                    )
                
                # Generate SQL for addition records
                additions = data_wrapper.get("addition", {})
                for desc, url in additions.items():
                    if url:  # Only add if URL exists
                        desc_escaped = escape_sql(desc)
                        full_url = url if url.startswith("http") else f"https://cons.judicial.gov.tw{url}"
                        url_escaped = escape_sql(full_url)
                        
                        sql_statements.append(
                            f"INSERT INTO interpretation_additions (interpretation_number, description, url) "
                            f"VALUES ('{inte_no}', {desc_escaped}, {url_escaped});"
                        )
                
                logger.info(f"Generated SQL for interpretation: {data.get('inte_no')} - {data.get('inte_no_title')}")
        
        # Write SQL statements to file
        with open(sql_output_path, 'w', encoding='utf-8') as sql_file:
            sql_file.write('\n'.join(sql_statements))
        
        logger.info(f"SQL statements written to {sql_output_path}")
        logger.info("Interpretation data SQL generation completed.")

@click.group()
def cli():
    """Data insertion tool for judicial data."""
    pass

@cli.command()
@click.pass_context
def update_categories(ctx):
    """Update categories from API."""
    logger.info("Starting category update...")
    update_category()

@cli.command()
@click.pass_context
def update_resources(ctx):
    """Update resources from API."""
    logger.info("Starting resource update...")
    update_resources()

@cli.command()
@click.pass_context
def sync_all(ctx):
    """Update both categories and resources."""
    logger.info("Starting full sync...")
    update_category()
    update_resources()

@cli.command()
def reset_tables():
    """Drop and recreate all database tables."""
    recreate_tables()

@cli.command()
def create_tables():
    """Create all database tables."""
    SQLModel.metadata.create_all(engine)

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
def insert_interpretations():
    """Insert interpretation data from JSON files."""
    logger.info("Starting interpretation data insertion...")
    insert_interpretation_data()

@cli.command()
@click.argument("law_data_file", type=click.Path(exists=True))
def insert_law_data(law_data_file):
    """Insert law data into the database."""
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
                    file_name=attachment.get("FileName"),
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
                    session.flush([last_caption])
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