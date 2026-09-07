# Background Jobs — Design Notes

## Decision

No task queue (Celery, RQ, etc.) has been introduced yet.
The application runs synchronously. This is intentional: the current load
does not justify the operational overhead of a broker + worker process.

## Operations identified as candidates for background processing

| Operation | Current behaviour | Trigger for moving to background |
|---|---|---|
| Stock import (CSV/XLSX) | Synchronous in-request (`StockImportView`) | > 1 000 rows or > 5 s p95 latency |
| Large XLSX report export | Synchronous in-request | > 10 000 rows or user-visible timeout |
| Large PDF batch generation | Synchronous in-request | Batch > 50 invoices |
| WhatsApp / SMS reminders | Synchronous Twilio call (`CustomerViewSet.send_reminder`) | Any production use — Twilio calls should never block a request |
| Bulk email notifications | Not yet implemented | At implementation time |

## Migration path when needed

1. Add `django-rq` (Redis Queue) or `celery[redis]` to `requirements.txt`.
2. Move the identified view logic into a task function in `api/tasks.py`.
3. The view returns `202 Accepted` with a job ID immediately.
4. The frontend polls a `/api/jobs/<id>/` status endpoint or uses WebSocket.

Do not introduce a broker until at least one of the triggers above is met.
