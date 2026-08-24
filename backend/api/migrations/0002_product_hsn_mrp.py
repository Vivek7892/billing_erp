from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE api_product ADD COLUMN IF NOT EXISTS hsn_code varchar(20) NOT NULL DEFAULT '';",
            reverse_sql="ALTER TABLE api_product DROP COLUMN IF EXISTS hsn_code;",
        ),
        migrations.RunSQL(
            sql="ALTER TABLE api_product ADD COLUMN IF NOT EXISTS mrp numeric(10,2) NOT NULL DEFAULT 0;",
            reverse_sql="ALTER TABLE api_product DROP COLUMN IF EXISTS mrp;",
        ),
        migrations.RunSQL(
            sql="ALTER TABLE api_invoiceitem ADD COLUMN IF NOT EXISTS hsn_code varchar(20) NOT NULL DEFAULT '';",
            reverse_sql="ALTER TABLE api_invoiceitem DROP COLUMN IF EXISTS hsn_code;",
        ),
        migrations.RunSQL(
            sql="ALTER TABLE api_invoiceitem ADD COLUMN IF NOT EXISTS mrp numeric(10,2) NOT NULL DEFAULT 0;",
            reverse_sql="ALTER TABLE api_invoiceitem DROP COLUMN IF EXISTS mrp;",
        ),
    ]
