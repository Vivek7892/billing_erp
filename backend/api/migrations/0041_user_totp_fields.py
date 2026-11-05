# Generated for Google Authenticator (TOTP) Login Security

from django.db import migrations, models


def add_totp_columns_safely(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'api_user';
            """)
            existing_cols = {row[0] for row in cursor.fetchall()}

            if 'totp_enabled' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_enabled boolean NOT NULL DEFAULT false;")
            if 'totp_secret' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_secret varchar(255) NOT NULL DEFAULT '';")
            if 'totp_confirmed_at' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_confirmed_at timestamp with time zone NULL;")
            if 'totp_recovery_codes' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;")
            if 'last_totp_timestep' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN last_totp_timestep bigint NULL;")
            if 'failed_totp_attempts' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN failed_totp_attempts smallint NOT NULL DEFAULT 0;")
            if 'last_failed_totp' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN last_failed_totp timestamp with time zone NULL;")

        elif connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(api_user);")
            existing_cols = {row[1] for row in cursor.fetchall()}

            if 'totp_enabled' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_enabled bool NOT NULL DEFAULT 0;")
            if 'totp_secret' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_secret varchar(255) NOT NULL DEFAULT '';")
            if 'totp_confirmed_at' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_confirmed_at datetime NULL;")
            if 'totp_recovery_codes' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN totp_recovery_codes text NOT NULL DEFAULT '[]';")
            if 'last_totp_timestep' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN last_totp_timestep integer NULL;")
            if 'failed_totp_attempts' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN failed_totp_attempts smallint NOT NULL DEFAULT 0;")
            if 'last_failed_totp' not in existing_cols:
                cursor.execute("ALTER TABLE api_user ADD COLUMN last_failed_totp datetime NULL;")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0040_user_created_by_user_custom_permissions_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='user',
                    name='totp_enabled',
                    field=models.BooleanField(default=False),
                ),
                migrations.AddField(
                    model_name='user',
                    name='totp_secret',
                    field=models.CharField(blank=True, default='', max_length=255),
                ),
                migrations.AddField(
                    model_name='user',
                    name='totp_confirmed_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='user',
                    name='totp_recovery_codes',
                    field=models.JSONField(blank=True, default=list),
                ),
                migrations.AddField(
                    model_name='user',
                    name='last_totp_timestep',
                    field=models.BigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='user',
                    name='failed_totp_attempts',
                    field=models.PositiveSmallIntegerField(default=0),
                ),
                migrations.AddField(
                    model_name='user',
                    name='last_failed_totp',
                    field=models.DateTimeField(blank=True, null=True),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_totp_columns_safely, reverse_code=migrations.RunPython.noop),
            ],
        ),
    ]

