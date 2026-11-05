from django.db import migrations, models
import django.core.validators


def add_columns_safely(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(api_product);")
            prod_cols = [row[1] for row in cursor.fetchall()]
            if 'hsn_code' not in prod_cols:
                cursor.execute("ALTER TABLE api_product ADD COLUMN hsn_code varchar(20) NOT NULL DEFAULT '';")
            if 'mrp' not in prod_cols:
                cursor.execute("ALTER TABLE api_product ADD COLUMN mrp numeric(10,2) NOT NULL DEFAULT 0;")
            cursor.execute("PRAGMA table_info(api_invoiceitem);")
            inv_cols = [row[1] for row in cursor.fetchall()]
            if 'hsn_code' not in inv_cols:
                cursor.execute("ALTER TABLE api_invoiceitem ADD COLUMN hsn_code varchar(20) NOT NULL DEFAULT '';")
            if 'mrp' not in inv_cols:
                cursor.execute("ALTER TABLE api_invoiceitem ADD COLUMN mrp numeric(10,2) NOT NULL DEFAULT 0;")
        else:
            cursor.execute("ALTER TABLE api_product ADD COLUMN IF NOT EXISTS hsn_code varchar(20) NOT NULL DEFAULT '';")
            cursor.execute("ALTER TABLE api_product ADD COLUMN IF NOT EXISTS mrp numeric(10,2) NOT NULL DEFAULT 0;")
            cursor.execute("ALTER TABLE api_invoiceitem ADD COLUMN IF NOT EXISTS hsn_code varchar(20) NOT NULL DEFAULT '';")
            cursor.execute("ALTER TABLE api_invoiceitem ADD COLUMN IF NOT EXISTS mrp numeric(10,2) NOT NULL DEFAULT 0;")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_columns_safely, reverse_code=migrations.RunPython.noop),
    ]
