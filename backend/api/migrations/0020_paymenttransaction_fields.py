from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_phonepe_to_razorpay'),
    ]

    operations = [
        migrations.AddField(
            model_name='razorpaytransaction',
            name='provider',
            field=models.CharField(default='razorpay', max_length=50),
        ),
        migrations.AddField(
            model_name='razorpaytransaction',
            name='merchant_transaction_id',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='razorpaytransaction',
            name='response_code',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='razorpaytransaction',
            name='provider_reference',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='razorpaytransaction',
            name='failure_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='razorpaytransaction',
            name='status',
            field=models.CharField(
                choices=[
                    ('created', 'Created'),
                    ('initiated', 'Initiated'),
                    ('pending', 'Pending'),
                    ('success', 'Success'),
                    ('failed', 'Failed'),
                    ('expired', 'Expired'),
                ],
                default='created',
                max_length=20,
            ),
        ),
    ]
