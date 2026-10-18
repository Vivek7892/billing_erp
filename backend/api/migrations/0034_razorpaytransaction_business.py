from django.db import migrations, models
import django.db.models.deletion


def populate_business_from_invoice(apps, schema_editor):
    Transaction = apps.get_model('api', 'RazorpayTransaction')
    for transaction in Transaction.objects.filter(business__isnull=True, invoice__isnull=False).iterator():
        Transaction.objects.filter(pk=transaction.pk).update(business_id=transaction.invoice.business_id)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0033_invoiceitem_manufacturing_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='razorpaytransaction',
            name='business',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='razorpay_transactions',
                to='api.business',
            ),
        ),
        migrations.RunPython(populate_business_from_invoice, migrations.RunPython.noop),
    ]
