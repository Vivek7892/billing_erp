@echo off
echo Starting ShopEase POS Backend...
cd /d %~dp0backend
python manage.py runserver 0.0.0.0:8000
