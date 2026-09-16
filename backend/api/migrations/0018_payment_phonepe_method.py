from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_phonepetransaction'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='method',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('cash', 'Cash'),
                    ('upi', 'UPI'),
                    ('card', 'Card'),
                    ('online', 'Online'),
                    ('credit', 'Credit'),
                    ('phonepe', 'PhonePe'),
                ],
            ),
        ),
    ]
