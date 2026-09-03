# Columns hsn_code and mrp were already added by 0006 via RunSQL IF NOT EXISTS.
# This migration is a no-op kept only to preserve the migration history chain.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_invoiceitem_hsn_code_invoiceitem_mrp_and_more'),
    ]

    operations = []
