"""Run `python -m app.coverage_worker` hourly or with --watch as a separate process."""
import argparse
import asyncio
from email.message import EmailMessage
import logging
import smtplib
import ssl
from app.main import create_app
from app.config import Settings
from app.coverage import dispatch

def send_notice(settings, recipient, country):
    message = EmailMessage()
    message['Subject'] = f'ТурСим: появились тарифы — {country}'
    message['From'] = settings.mail_from.strip() or settings.smtp_username.strip()
    message['To'] = recipient
    message.set_content(f'Вы просили сообщить, когда появятся тарифы: {country}.\nОткройте приложение ТурСим, чтобы посмотреть актуальные пакеты и цены.\nЭто разовое уведомление по вашей заявке.')
    context = ssl.create_default_context()
    connection = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15, context=context) if settings.smtp_use_ssl else smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    with connection as smtp:
        if not settings.smtp_use_ssl:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
        smtp.login(settings.smtp_username.strip(), settings.smtp_password.get_secret_value().replace(' ', ''))
        if smtp.send_message(message):
            raise smtplib.SMTPException('Recipient rejected')

async def run(watch=False):
    settings = Settings()
    app = create_app(settings)
    app.state.auth.require_smtp()
    async with app.router.lifespan_context(app):
        while True:
            try:
                count = await dispatch(app.state.auth, app.state.catalog, lambda recipient, country: send_notice(settings, recipient, country))
                logging.info('Coverage notifications sent: %d', count)
            except Exception:
                logging.error('Coverage check failed; pending requests retained')
                if not watch:
                    raise
            if not watch:
                return
            await asyncio.sleep(3600)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run(parser.parse_args().watch))
