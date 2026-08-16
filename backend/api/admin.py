from django.contrib import admin
from .models import *

admin.site.register(User)
admin.site.register(Category)
admin.site.register(Product)
admin.site.register(Customer)
admin.site.register(Supplier)
admin.site.register(Invoice)
admin.site.register(Purchase)
admin.site.register(Setting)
