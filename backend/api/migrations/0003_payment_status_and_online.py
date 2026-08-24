from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0002_product_hsn_mrp')]

    operations = [
        migrations.AlterField(
            model_name='invoice', name='payment_status',
            field=models.CharField(choices=[('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed'), ('partial', 'Partial'), ('credit', 'Credit')], default='paid', max_length=10),
        ),
        migrations.AlterField(
            model_name='payment', name='method',
            field=models.CharField(choices=[('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online'), ('credit', 'Credit')], max_length=10),
        ),
    ]
