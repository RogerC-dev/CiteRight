from datetime import datetime
from typing import List, Optional

import sqlmodel
from sqlalchemy import Text, Column


class InterpretationsZH(sqlmodel.SQLModel, table=True):
    # This class is defined first so it can be referenced below without forward-referencing ("quotes").
    __tablename__ = "interpretations_zh"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    interpretation_number: str = sqlmodel.Field(foreign_key="interpretations.interpretation_number", index=True, unique=True, max_length=10)
    number_title: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    issue: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    description: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    reasoning: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    other_documents: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    interpretation_kind_1: Optional[str] = sqlmodel.Field(default=None, max_length=10)
    interpretation_kind_2: Optional[str] = sqlmodel.Field(default=None, max_length=10)
    fact: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))

    interpretation: "Interpretations" = sqlmodel.Relationship(back_populates="interpretation_zh")


class InterpretationsEN(sqlmodel.SQLModel, table=True):
    __tablename__ = "interpretations_en"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    interpretation_number: str = sqlmodel.Field(foreign_key="interpretations.interpretation_number", index=True, unique=True, max_length=10)
    number_title: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    issue: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    description: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    reasoning: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    fact: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    other_opinion: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    constitutional_complaint: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    decision: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    regulations: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    appendix: Optional[str] = sqlmodel.Field(default=None, sa_column=Column(Text))
    
    interpretation: "Interpretations" = sqlmodel.Relationship(back_populates="interpretation_en")


class InterpretationAdditions(sqlmodel.SQLModel, table=True):
    __tablename__ = "interpretation_additions"

    addition_id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    interpretation_number: str = sqlmodel.Field(foreign_key="interpretations.interpretation_number", index=True, max_length=10)
    description: str = sqlmodel.Field(max_length=255)
    url: str = sqlmodel.Field(max_length=512)

    # CORRECT: An "addition" belongs to ONE interpretation.
    interpretation: "Interpretations" = sqlmodel.Relationship(back_populates="interpretation_additions")


class Interpretations(sqlmodel.SQLModel, table=True):
    __tablename__ = "interpretations"

    interpretation_number: str = sqlmodel.Field(primary_key=True, max_length=10)
    interpretation_date: Optional[datetime] = sqlmodel.Field(default=None)
    source_url: Optional[str] = sqlmodel.Field(default=None, max_length=512)
    order: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    order_title: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    order_change: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    number_change: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    announcement_order: Optional[str] = sqlmodel.Field(default=None, max_length=255)
    amendment_order: Optional[str] = sqlmodel.Field(default=None, max_length=255)

    # One-to-one relationships. `uselist=False` makes this explicit.
    interpretation_zh: Optional[InterpretationsZH] = sqlmodel.Relationship(
        back_populates="interpretation", sa_relationship_kwargs={"uselist": False}
    )
    interpretation_en: Optional[InterpretationsEN] = sqlmodel.Relationship(
        back_populates="interpretation", sa_relationship_kwargs={"uselist": False}
    )

    # CORRECT: An interpretation can have MANY "additions".
    interpretation_additions: List[InterpretationAdditions] = sqlmodel.Relationship(back_populates="interpretation")
