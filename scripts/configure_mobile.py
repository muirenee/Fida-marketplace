"""Apply branding, Android permissions and optional Firebase CI configuration."""
import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET

app = Path.cwd()
role = app.name.replace('-mobile', '')
android = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', android)
manifest = app / 'android/app/src/main/AndroidManifest.xml'
tree = ET.parse(manifest)
root = tree.getroot()
permissions = ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS']
if role == 'driver':
    permissions += ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_LOCATION', 'android.permission.ACCESS_BACKGROUND_LOCATION']
for permission in permissions:
    if not any(el.get(f'{{{android}}}name') == permission for el in root.findall('uses-permission')):
        ET.SubElement(root, 'uses-permission', {f'{{{android}}}name': permission})
application = root.find('application')
application.set(f'{{{android}}}label', 'Fida Marketplace' if role == 'customer' else f'Fida {role.title()}')
application.set(f'{{{android}}}icon', '@drawable/fida_icon')
ET.SubElement(application, 'meta-data', {f'{{{android}}}name': 'com.google.firebase.messaging.default_notification_channel_id', f'{{{android}}}value': 'fida_orders'})
ET.SubElement(application, 'meta-data', {f'{{{android}}}name': 'com.google.firebase.messaging.default_notification_icon', f'{{{android}}}resource': '@drawable/fida_notification'})
tree.write(manifest, encoding='unicode')
drawable = app / 'android/app/src/main/res/drawable'
drawable.mkdir(parents=True, exist_ok=True)
(drawable / 'fida_icon.xml').write_text('''<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#087F5B" android:pathData="M0,0h108v108H0z"/><path android:fillColor="#D5F2AA" android:pathData="M28,38h52l-4,46H32z"/><path android:fillColor="@android:color/transparent" android:strokeColor="#FFFFFF" android:strokeWidth="6" android:strokeLineCap="round" android:pathData="M40,40v-8a14,14 0,0 1,28 0v8"/><path android:fillColor="#087F5B" android:pathData="M45,50h21v7H53v6h11v7H53v9H45z"/></vector>''')
(drawable / 'fida_notification.xml').write_text('''<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFF" android:pathData="M5,7h14l-1,15H6zM8,7V5a4,4 0,0 1,8 0v2h-2V5a2,2 0,0 0,-4 0v2z"/></vector>''')
# Install the channel before FCM receives a background notification.
for activity in (app / 'android/app/src/main/kotlin').rglob('MainActivity.kt'):
    package = next(line for line in activity.read_text().splitlines() if line.startswith('package '))
    activity.write_text(package + '''
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
class MainActivity: FlutterActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
   val channel = NotificationChannel("fida_orders", "Orders and deliveries", NotificationManager.IMPORTANCE_HIGH)
   channel.description = "Order updates and new delivery offers"
   getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }
 }
}
''')
config = os.environ.get('FIDA_FIREBASE_CONFIG_JSON', '').strip()
defines = {}
if config:
    config = json.loads(config)
    # Use one google-services.json for each app, registered to its exact package ID.
    package = f'com.fidalix.marketplace.{role}_mobile'
    client = next(c for c in config['client'] if c['client_info']['android_client_info']['package_name'] == package)
    defines = {'FIDA_FIREBASE_API_KEY': client['api_key'][0]['current_key'], 'FIDA_FIREBASE_APP_ID': client['client_info']['mobilesdk_app_id'], 'FIDA_FIREBASE_SENDER_ID': config['project_info']['project_number'], 'FIDA_FIREBASE_PROJECT_ID': config['project_info']['project_id']}
(app / 'firebase-defines.json').write_text(json.dumps(defines))
print(f'Configured Fida {role}; push configuration: {"present" if defines else "not supplied"}')
