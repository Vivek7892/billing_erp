from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_paymenttransaction_fields'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='invoice',
            name='date',
        ),
    ]
