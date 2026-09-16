from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_payment_phonepe_method'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='PhonePeTransaction',
            new_name='RazorpayTransaction',
        ),
        migrations.RenameField(
            model_name='razorpaytransaction',
            old_name='merchant_transaction_id',
            new_name='razorpay_order_id',
        ),
        migrations.RenameField(
            model_name='razorpaytransaction',
            old_name='phonepe_transaction_id',
            new_name='razorpay_payment_id',
        ),
        migrations.RemoveField(
            model_name='razorpaytransaction',
            name='payment_url',
        ),
        migrations.AddField(
            model_name='razorpaytransaction',
            name='razorpay_signature',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AlterField(
            model_name='payment',
            name='method',
            field=models.CharField(
                choices=[
                    ('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'),
                    ('online', 'Online'), ('credit', 'Credit'), ('razorpay', 'Razorpay'),
                ],
                max_length=10,
            ),
        ),
    ]
