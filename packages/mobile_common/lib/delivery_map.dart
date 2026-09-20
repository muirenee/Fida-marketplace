import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

/// An actual street map. Marker positions come from authenticated order data.
/// No fabricated road route or arrival time is drawn between the points.
class DeliveryMap extends StatelessWidget {
  const DeliveryMap({
    super.key,
    this.driverLatitude,
    this.driverLongitude,
    this.pickupLatitude,
    this.pickupLongitude,
    this.dropoffLatitude,
    this.dropoffLongitude,
    this.height = 300,
    this.stale = false,
  });
  final Object? driverLatitude,
      driverLongitude,
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude;
  final double height;
  final bool stale;
  LatLng? _point(Object? lat, Object? lon) {
    final a = double.tryParse('$lat'), b = double.tryParse('$lon');
    if (a == null ||
        b == null ||
        !a.isFinite ||
        !b.isFinite ||
        a.abs() > 90 ||
        b.abs() > 180)
      return null;
    return LatLng(a, b);
  }

  @override
  Widget build(BuildContext context) {
    final driver = _point(driverLatitude, driverLongitude);
    final pickup = _point(pickupLatitude, pickupLongitude);
    final dropoff = _point(dropoffLatitude, dropoffLongitude);
    final points = [driver, pickup, dropoff].whereType<LatLng>().toList();
    if (points.isEmpty)
      return SizedBox(
        height: 160,
        child: Center(
          child: Text(
            'Waiting for a precise location',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
      );
    Marker marker(LatLng point, IconData icon, String label, Color color) =>
        Marker(
          point: point,
          width: 48,
          height: 48,
          child: Tooltip(
            message: label,
            child: Container(
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: const [
                  BoxShadow(blurRadius: 8, color: Colors.black26),
                ],
              ),
              child: Icon(icon, color: Colors.white, size: 25),
            ),
          ),
        );
    return SizedBox(
      height: height,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: FlutterMap(
          // Keep the camera steady as the courier marker moves. Recenter via the button.
          options: MapOptions(
            initialCenter: driver ?? dropoff ?? pickup!,
            initialZoom: 14,
            initialCameraFit: points.length > 1
                ? CameraFit.bounds(
                    bounds: LatLngBounds.fromPoints(points),
                    padding: const EdgeInsets.all(54),
                    maxZoom: 16,
                  )
                : null,
          ),
          children: [
            TileLayer(
              urlTemplate: const String.fromEnvironment(
                'FIDA_MAP_TILE_URL',
                defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              ),
              userAgentPackageName: 'com.fidalix.marketplace',
              maxZoom: 19,
            ),
            MarkerLayer(
              markers: [
                if (pickup != null)
                  marker(
                    pickup,
                    Icons.storefront,
                    'Pickup',
                    const Color(0xFF111111),
                  ),
                if (dropoff != null)
                  marker(
                    dropoff,
                    Icons.home_rounded,
                    'Delivery address',
                    const Color(0xFF07855A),
                  ),
                if (driver != null)
                  marker(
                    driver,
                    Icons.delivery_dining,
                    stale ? 'Last known driver position' : 'Driver',
                    stale ? Colors.grey : const Color(0xFF276EF1),
                  ),
              ],
            ),
            RichAttributionWidget(
              attributions: [
                TextSourceAttribution(
                  'OpenStreetMap contributors',
                  onTap: () => launchUrl(
                    Uri.parse('https://www.openstreetmap.org/copyright'),
                  ),
                ),
              ],
            ),
            Builder(
              builder: (ctx) => Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: IconButton.filledTonal(
                    tooltip: 'Recenter map',
                    onPressed: () => MapController.of(
                      ctx,
                    ).move(driver ?? dropoff ?? pickup!, 15),
                    icon: const Icon(Icons.my_location),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
