import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('api.exceptions')

def custom_exception_handler(exc, context):
    """
    Consistent, production-grade exception handler for Django REST Framework.
    - Standardizes response structure (success, status_code, error, detail, errors).
    - Preserves field-level validation errors for form bindings and legacy clients.
    - Handles unexpected Python exceptions (HTTP 500) gracefully without leaking stack traces.
    """
    response = exception_handler(exc, context)

    # 1. Handled DRF exceptions (ValidationError, PermissionDenied, NotAuthenticated, NotFound, Throttled, etc.)
    if response is not None:
        custom_data = {
            "success": False,
            "status_code": response.status_code,
        }

        if isinstance(response.data, dict):
            # Check standard DRF keys
            if "detail" in response.data:
                msg = str(response.data["detail"])
                custom_data["detail"] = msg
                custom_data["error"] = msg
            elif "message" in response.data:
                msg = str(response.data["message"])
                custom_data["detail"] = msg
                custom_data["error"] = msg
            elif "error" in response.data:
                msg = str(response.data["error"])
                custom_data["detail"] = msg
                custom_data["error"] = msg
            else:
                # Validation error dictionary: e.g. {"username": ["A user with that username already exists."]}
                first_key = next(iter(response.data))
                first_err = response.data[first_key]
                first_msg = first_err[0] if isinstance(first_err, (list, tuple)) and first_err else str(first_err)
                field_label = "Error" if first_key in ("non_field_errors", "detail") else first_key.replace('_', ' ').capitalize()
                custom_data["detail"] = f"{field_label}: {first_msg}" if field_label != "Error" else str(first_msg)
                custom_data["error"] = "Validation Error"

            custom_data["errors"] = response.data

            # Preserve all original dictionary keys for backward compatibility
            for key, val in response.data.items():
                if key not in custom_data:
                    custom_data[key] = val

        elif isinstance(response.data, (list, tuple)):
            first_msg = response.data[0] if response.data else "Validation error"
            custom_data["detail"] = str(first_msg)
            custom_data["error"] = str(first_msg)
            custom_data["errors"] = {"non_field_errors": list(response.data)}
        else:
            custom_data["detail"] = str(response.data)
            custom_data["error"] = str(response.data)

        response.data = custom_data
        return response

    # 2. Unhandled server exceptions (HTTP 500 Internal Server Error)
    view = context.get('view', None)
    view_name = view.__class__.__name__ if view else 'UnknownView'
    request = context.get('request', None)
    req_path = request.path if request else 'UnknownPath'
    logger.exception(f"Unhandled exception in {view_name} at {req_path}: {exc}")

    return Response(
        {
            "success": False,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "error": "Internal Server Error",
            "detail": "An unexpected server error occurred. Please try again later or contact support.",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )

