from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='hsn_code',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='product',
            name='mrp',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        migrations.AddField(
            model_name='invoiceitem',
            name='hsn_code',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='invoiceitem',
            name='mrp',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
