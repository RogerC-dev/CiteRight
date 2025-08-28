from sqlmodel import SQLModel, Session, create_engine
import json
import pathlib

from models import Interpretations, InterpretationsZH, InterpretationsEN, InterpretationAdditions

engine = create_engine("mariadb+mariadbconnector://root:pbiecs123456@140.134.24.157:23306/D1397218_LawExtension")

# files = pathlib.Path("data").glob("*.json")

# for file in files:
#     with open(file, "r", encoding="utf-8") as f:
#         data = json.load(f)
#         Interpretations(
#             interpretation_number=data["data"]["inte_no"],
#             interpretation_date=data["data"]["inte_order"],
#             source_url=file.as_uri()
#         )

SQLModel.metadata.create_all(engine)

with Session(engine) as session:
    pass