
from datetime import date, datetime
from typing import List, Optional

import sqlmodel

from sqlmodel import Relationship
from sqlalchemy.orm import Mapped, relationship, foreign
from sqlalchemy import ForeignKeyConstraint, Boolean, Date, DateTime, Text


class LawAttachment(sqlmodel.SQLModel, table=True):
    __tablename__ = "LawAttachment"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True, sa_column_kwargs={"name": "Id"})
    law_level: str = sqlmodel.Field(index=True, max_length=50, sa_column_kwargs={"name": "LawLevel"})
    law_name: str = sqlmodel.Field(index=True, max_length=255, sa_column_kwargs={"name": "LawName"})
    title: Optional[str] = sqlmodel.Field(default=None, max_length=255, sa_column_kwargs={"name": "Title"})
    file_url: str = sqlmodel.Field(max_length=500, sa_column_kwargs={"name": "FileUrl"})

    __table_args__ = (
        ForeignKeyConstraint(
            ["LawLevel", "LawName"],
            ["Law.LawLevel", "Law.LawName"],
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
    )

    law: "Law" = Relationship(back_populates="attachments")


class LawCaption(sqlmodel.SQLModel, table=True):
    __tablename__ = "LawCaption"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True, sa_column_kwargs={"name": "Id"})
    law_level: str = sqlmodel.Field(index=True, max_length=50, sa_column_kwargs={"name": "LawLevel"})
    law_name: str = sqlmodel.Field(index=True, max_length=255, sa_column_kwargs={"name": "LawName"})
    caption_title: str = sqlmodel.Field(max_length=255, sa_column_kwargs={"name": "CaptionTitle"})

    __table_args__ = (
        ForeignKeyConstraint(
            ["LawLevel", "LawName"],
            ["Law.LawLevel", "Law.LawName"],
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
    )

    law: "Law" = Relationship(back_populates="captions")
    articles: List["LawArticle"] = Relationship(back_populates="caption", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class LawArticle(sqlmodel.SQLModel, table=True):
    __tablename__ = "LawArticle"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True, sa_column_kwargs={"name": "Id"})
    caption_id: Optional[int] = sqlmodel.Field(foreign_key="LawCaption.Id", index=True, sa_column_kwargs={"name": "CaptionId"})
    article_no: str = sqlmodel.Field(max_length=50, sa_column_kwargs={"name": "ArticleNo"})
    law_level: str = sqlmodel.Field(index=True, max_length=50, sa_column_kwargs={"name": "LawLevel"})
    law_name: str = sqlmodel.Field(index=True, max_length=255, sa_column_kwargs={"name": "LawName"})
    article_content: str = sqlmodel.Field(sa_column=sqlmodel.Column(Text, name="ArticleContent"))

    __table_args__ = (
        ForeignKeyConstraint(
            ["LawLevel", "LawName"],
            ["Law.LawLevel", "Law.LawName"],
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
    )
    law: "Law" = Relationship(back_populates="articles")
    caption: "LawCaption" = Relationship(back_populates="articles")


class Law(sqlmodel.SQLModel, table=True):
    __tablename__ = "Law"

    law_level: str = sqlmodel.Field(primary_key=True, max_length=50, sa_column_kwargs={"name": "LawLevel"})
    law_name: str = sqlmodel.Field(primary_key=True, max_length=255, sa_column_kwargs={"name": "LawName"})
    law_url: str = sqlmodel.Field(max_length=500, sa_column_kwargs={"name": "LawUrl"})
    law_category: str = sqlmodel.Field(max_length=100, sa_column_kwargs={"name": "LawCategory"})
    law_modified_date: Optional[date] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Date, name="LawModifiedDate"))
    law_effective_date: Optional[date] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Date, name="LawEffectiveDate"))
    law_effective_note: Optional[str] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Text, name="LawEffectiveNote"))
    law_abandon_note: Optional[str] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Text, name="LawAbandonNote"))
    law_histories: Optional[str] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Text, name="LawHistories"))
    law_has_eng_version: bool = sqlmodel.Field(default=False, sa_column=sqlmodel.Column(Boolean, name="LawHasEngVersion"))
    eng_law_name: Optional[str] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Text, name="EngLawName"))
    law_foreword: Optional[str] = sqlmodel.Field(default=None, sa_column=sqlmodel.Column(Text, name="LawForeword"))
    created_at: datetime = sqlmodel.Field(default_factory=datetime.now, sa_column=sqlmodel.Column(DateTime, name="CreatedAt"))
    updated_at: datetime = sqlmodel.Field(default_factory=datetime.now, sa_column=sqlmodel.Column(DateTime, name="UpdatedAt"))

    attachments: List["LawAttachment"] = Relationship(
        back_populates="law", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    captions: List["LawCaption"] = Relationship(
        back_populates="law", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    articles: List["LawArticle"] = Relationship(
        back_populates="law", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
