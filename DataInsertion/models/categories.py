from __future__ import annotations

from typing import List, Optional

import sqlmodel

from sqlalchemy.orm import Mapped, relationship

import API

class Categories(sqlmodel.SQLModel, table=True):
    __tablename__ = "Categories"

    category_no: str = sqlmodel.Field(primary_key=True, max_length=10)
    category_name: str = sqlmodel.Field(max_length=255)

    resources: Mapped[List["Resources"]] = sqlmodel.Relationship(
        cascade_delete=True,
        back_populates="category",
        sa_relationship=relationship(back_populates="category")
    )

class Resources(sqlmodel.SQLModel, table=True):
    __tablename__ = "Resources"

    dataset_id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    category_no: str = sqlmodel.Field(foreign_key="Categories.category_no", index=True, max_length=10)
    title: str = sqlmodel.Field(max_length=255)

    category: "Categories" = sqlmodel.Relationship(
        back_populates="resources",
        sa_relationship=relationship(back_populates="resources")
    )

    resource_files: Mapped[List["ResourceFiles"]] = sqlmodel.Relationship(
        cascade_delete=True, 
        sa_relationship=relationship(back_populates="resource")
    )


class ResourceFiles(sqlmodel.SQLModel, table=True):
    __tablename__ = "ResourceFiles"

    dataset_id: int = sqlmodel.Field(foreign_key="Resources.dataset_id", index=True)
    file_set_id: int = sqlmodel.Field(primary_key=True)
    resource_format: str = sqlmodel.Field(max_length=10)
    resource_description: str = sqlmodel.Field(max_length=255)

    resource: "Resources" = sqlmodel.Relationship(
        back_populates="resource_files",
        sa_relationship=relationship(back_populates="resource_files")
    )

    def get_download_url(self) -> str:
        return API.JUDICIAL_CATEGORYS_FILE_API.format(file_set_id=self.file_set_id)