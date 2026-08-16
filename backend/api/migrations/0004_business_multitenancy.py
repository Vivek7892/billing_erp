from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [('api', '0003_payment_status_and_online')]

    operations = [
        # Business
        migrations.CreateModel(
            name='Business',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('business_type', models.CharField(blank=True, max_length=100)),
                ('owner_name', models.CharField(blank=True, max_length=200)),
                ('mobile', models.CharField(blank=True, max_length=15)),
                ('email', models.EmailField(blank=True)),
                ('address', models.TextField(blank=True)),
                ('gstin', models.CharField(blank=True, max_length=15)),
                ('pan', models.CharField(blank=True, max_length=10)),
                ('logo', models.ImageField(blank=True, null=True, upload_to='shop_logos/')),
                ('invoice_prefix', models.CharField(default='INV', max_length=20)),
                ('invoice_start_number', models.PositiveIntegerField(default=1001)),
                ('currency', models.CharField(default='₹', max_length=10)),
                ('tax_enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'verbose_name_plural': 'businesses'},
        ),
        # OTPRecord
        migrations.CreateModel(
            name='OTPRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('identifier', models.CharField(max_length=200)),
                ('purpose', models.CharField(choices=[('signup', 'Signup'), ('login', 'Login'), ('reset', 'Password Reset')], max_length=20)),
                ('otp_hash', models.CharField(max_length=128)),
                ('expires_at', models.DateTimeField()),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('is_verified', models.BooleanField(default=False)),
                ('is_used', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_resend_at', models.DateTimeField(blank=True, null=True)),
                ('resend_count', models.PositiveSmallIntegerField(default=0)),
            ],
        ),
        migrations.AddIndex(
            model_name='otprecord',
            index=models.Index(fields=['identifier', 'purpose', 'is_verified'], name='api_otpreco_identif_idx'),
        ),
        # Add business FK to User
        migrations.AddField(
            model_name='user',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='members', to='api.business'),
        ),
        migrations.AddField(
            model_name='user',
            name='failed_login_attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='user',
            name='last_failed_login',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('owner', 'Owner'), ('admin', 'Admin'), ('manager', 'Manager'), ('cashier', 'Cashier'), ('accountant', 'Accountant')], default='cashier', max_length=20),
        ),
        # Rebuild AuditLog
        migrations.DeleteModel(name='AuditLog'),
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=100)),
                ('module', models.CharField(blank=True, max_length=100)),
                ('entity', models.CharField(blank=True, max_length=100)),
                ('entity_id', models.CharField(blank=True, max_length=100)),
                ('previous_value', models.TextField(blank=True)),
                ('new_value', models.TextField(blank=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('result', models.CharField(choices=[('success', 'Success'), ('failure', 'Failure')], default='success', max_length=10)),
                ('failure_reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.business')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
            options={'ordering': ['-created_at']},
        ),
        # Add business FK to existing models
        migrations.AddField(
            model_name='category',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AlterUniqueTogether('category', unique_together={('business', 'name')}),
        migrations.AddField(
            model_name='supplier',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AddField(
            model_name='supplier',
            name='outstanding_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='product',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AlterUniqueTogether('product', unique_together={('business', 'sku')}),
        migrations.AlterField(
            model_name='product',
            name='sku',
            field=models.CharField(max_length=100),
        ),
        migrations.AddField(
            model_name='customer',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AddField(
            model_name='purchase',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AddField(
            model_name='invoice',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='invoice_number',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterUniqueTogether('invoice', unique_together={('business', 'invoice_number')}),
        migrations.RunSQL(sql='SELECT 1', reverse_sql='SELECT 1'),  # status already exists from 0001_initial
        migrations.AddField(
            model_name='inventorytransaction',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        # Setting: add business FK, remove unique on key alone
        migrations.AlterUniqueTogether('setting', unique_together=set()),
        migrations.AddField(
            model_name='setting',
            name='business',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business'),
        ),
        migrations.AlterUniqueTogether('setting', unique_together={('business', 'key')}),
        # New models
        migrations.CreateModel(
            name='ExpenseCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business')),
            ],
            options={'unique_together': {('business', 'name')}},
        ),
        migrations.CreateModel(
            name='Expense',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('description', models.CharField(max_length=300)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_method', models.CharField(choices=[('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online')], default='cash', max_length=20)),
                ('expense_date', models.DateField()),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business')),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.expensecategory')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
        ),
        migrations.CreateModel(
            name='CustomerPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('method', models.CharField(choices=[('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online')], default='cash', max_length=20)),
                ('reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='api.customer')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
        ),
        migrations.CreateModel(
            name='SupplierPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('method', models.CharField(choices=[('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('online', 'Online')], default='cash', max_length=20)),
                ('reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='api.supplier')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
        ),
        migrations.CreateModel(
            name='SalesReturn',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('return_number', models.CharField(max_length=50)),
                ('reason', models.TextField(blank=True)),
                ('refund_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('refund_method', models.CharField(default='cash', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business')),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='returns', to='api.invoice')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
        ),
        migrations.CreateModel(
            name='SalesReturnItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_name', models.CharField(max_length=200)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=10)),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('total', models.DecimalField(decimal_places=2, max_digits=12)),
                ('invoice_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.invoiceitem')),
                ('product', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.product')),
                ('sales_return', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='api.salesreturn')),
            ],
        ),
        migrations.CreateModel(
            name='PurchaseReturn',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('return_number', models.CharField(max_length=50)),
                ('reason', models.TextField(blank=True)),
                ('debit_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.business')),
                ('purchase', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='returns', to='api.purchase')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
        ),
        migrations.CreateModel(
            name='PurchaseReturnItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_name', models.CharField(max_length=200)),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=10)),
                ('purchase_price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('total', models.DecimalField(decimal_places=2, max_digits=12)),
                ('product', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.product')),
                ('purchase_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.purchaseitem')),
                ('purchase_return', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='api.purchasereturn')),
            ],
        ),
    ]
