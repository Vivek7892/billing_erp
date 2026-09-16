from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_shortlink'),
    ]

    operations = [
        migrations.CreateModel(
            name='PhonePeTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('merchant_transaction_id', models.CharField(max_length=100, unique=True)),
                ('phonepe_transaction_id', models.CharField(blank=True, max_length=100)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(choices=[('initiated', 'Initiated'), ('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='initiated', max_length=20)),
                ('payment_url', models.TextField(blank=True)),
                ('response_data', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('invoice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='phonepe_transactions', to='api.invoice')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
