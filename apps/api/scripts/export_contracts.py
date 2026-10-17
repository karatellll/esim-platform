import json
from pathlib import Path

from app.main import app
from app.models import CatalogCategoriesResponse, CatalogTariffsResponse

destination = Path(__file__).resolve().parents[3] / "packages/shared/contracts"
destination.mkdir(parents=True, exist_ok=True)

for name, schema in [
    ("openapi.json", app.openapi()),
    ("catalog.schema.json", CatalogCategoriesResponse.model_json_schema()),
    ("tariffs.schema.json", CatalogTariffsResponse.model_json_schema()),
]:
    (destination / name).write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("Exported OpenAPI and catalog response schema")
