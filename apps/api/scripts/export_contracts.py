import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.coverage import CoverageRequest, CoverageSubscription, CoverageSubscriptions
from app.main import app
from app.support import SupportMessageRequest, SupportResponse
from app.auth_models import ProfileUpdateRequest
from app.auth_models import AuthErrorResponse, SendCodeResponse, SessionResponse, MeResponse
from app.models import CatalogCategoriesResponse, CatalogTariffsResponse
from app.checkout import CheckoutSelection, CheckoutSummaryResponse, CheckoutOrderRequest
from app.order_models import OrderEnvelope, OrdersEnvelope

destination = Path(__file__).resolve().parents[3] / "packages/shared/contracts"
destination.mkdir(parents=True, exist_ok=True)

for name, schema in [
    ("openapi.json", app.openapi()),
    ("coverage-request.schema.json", CoverageRequest.model_json_schema()),
    ("coverage-subscription.schema.json", CoverageSubscription.model_json_schema()),
    ("coverage-subscriptions.schema.json", CoverageSubscriptions.model_json_schema()),
    ("profile-update.schema.json", ProfileUpdateRequest.model_json_schema()),
    ("support-request.schema.json", SupportMessageRequest.model_json_schema()),
    ("support.schema.json", SupportResponse.model_json_schema()),
    ("auth-error.schema.json", AuthErrorResponse.model_json_schema()),
    ("auth-send-code.schema.json", SendCodeResponse.model_json_schema()),
    ("auth-session.schema.json", SessionResponse.model_json_schema()),
    ("auth-user.schema.json", MeResponse.model_json_schema()),
    ("catalog.schema.json", CatalogCategoriesResponse.model_json_schema()),
    ("tariffs.schema.json", CatalogTariffsResponse.model_json_schema()),
    ("checkout-selection.schema.json", CheckoutSelection.model_json_schema()),
    ("checkout-summary.schema.json", CheckoutSummaryResponse.model_json_schema()),
    ("checkout-order.schema.json", CheckoutOrderRequest.model_json_schema()),
    ("order.schema.json", OrderEnvelope.model_json_schema()),
    ("orders.schema.json", OrdersEnvelope.model_json_schema()),
]:
    (destination / name).write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("Exported OpenAPI, catalog, authentication, and checkout schemas")
