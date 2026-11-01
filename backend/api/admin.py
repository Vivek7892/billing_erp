from django.contrib import admin
from .models import (
    User, Category, Product, Customer, Supplier, Invoice,
    ShortLink, Purchase, Setting, RazorpayTransaction,
    Business, RetiredShopID
)


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('shop_id', 'name', 'owner_name', 'mobile', 'email', 'city', 'state', 'created_at')
    search_fields = ('shop_id', 'name', 'owner_name', 'mobile', 'email', 'gstin')
    readonly_fields = ('id', 'shop_id', 'created_at')
    ordering = ('-created_at',)


@admin.register(RetiredShopID)
class RetiredShopIDAdmin(admin.ModelAdmin):
    list_display = ('shop_id', 'business_name', 'retired_at')
    search_fields = ('shop_id', 'business_name')
    readonly_fields = ('shop_id', 'business_name', 'retired_at')
    ordering = ('-retired_at',)


admin.site.register(User)
admin.site.register(Category)
admin.site.register(Product)
admin.site.register(Customer)
admin.site.register(Supplier)
admin.site.register(Invoice)
admin.site.register(ShortLink)
admin.site.register(Purchase)
admin.site.register(Setting)
admin.site.register(RazorpayTransaction)
