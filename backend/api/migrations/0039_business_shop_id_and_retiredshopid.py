from django.db import migrations, models
import secrets
import string


def populate_existing_shop_ids(apps, schema_editor):
    """
    Safely assign unique DWAAYYNN Shop IDs to any existing shops.
    Requirement 14: Safely migrate existing shops and assign IDs.
    """
    Business = apps.get_model('api', 'Business')
    RetiredShopID = apps.get_model('api', 'RetiredShopID')

    used_ids = set(RetiredShopID.objects.values_list('shop_id', flat=True))
    used_ids.update(Business.objects.exclude(shop_id__isnull=True).exclude(shop_id='').values_list('shop_id', flat=True))

    for biz in Business.objects.filter(models.Q(shop_id__isnull=True) | models.Q(shop_id='')):
        year = (biz.created_at.year if biz.created_at else 2026) % 100
        yy = f"{year:02d}"

        # Generate unique candidate
        candidate = None
        for _ in range(500):
            letters = ''.join(secrets.choice(string.ascii_uppercase) for _ in range(2))
            digits = f"{secrets.randbelow(100):02d}"
            code = f"DW{letters}{yy}{digits}"
            if code not in used_ids:
                candidate = code
                used_ids.add(code)
                break

        if not candidate:
            raise ValueError(f"Failed to generate unique Shop ID for business {biz.id}")

        biz.shop_id = candidate
        biz.save(update_fields=['shop_id'])


def reverse_populate(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0038_payment_created_by_payment_notes_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='RetiredShopID',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('shop_id', models.CharField(max_length=12, unique=True)),
                ('business_name', models.CharField(blank=True, max_length=200)),
                ('retired_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Retired Shop ID',
                'verbose_name_plural': 'Retired Shop IDs',
                'ordering': ['-retired_at'],
            },
        ),
        migrations.AddField(
            model_name='business',
            name='shop_id',
            field=models.CharField(
                blank=True,
                editable=False,
                help_text='Unique 7/8-character Shop ID in DWAAYYNN format (e.g. DWKT2618)',
                max_length=12,
                null=True,
            ),
        ),
        migrations.RunPython(populate_existing_shop_ids, reverse_populate),
        migrations.RunSQL(
            sql="DROP INDEX IF EXISTS api_business_shop_id_c35711f3_like; DROP INDEX IF EXISTS api_business_shop_id_key;",
            reverse_sql="",
        ),
        migrations.AlterField(
            model_name='business',
            name='shop_id',
            field=models.CharField(
                blank=True,
                editable=False,
                help_text='Unique 7/8-character Shop ID in DWAAYYNN format (e.g. DWKT2618)',
                max_length=12,
                null=True,
                unique=True,
            ),
        ),
    ]
