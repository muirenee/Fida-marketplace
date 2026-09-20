import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api_client.dart';

class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<Map<String, dynamic>> rows = [];
  String? error;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await widget.api.addresses();
      if (mounted) setState(() => rows = data);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> add() async {
    String address = '', city = '', label = 'Home';
    Position? position;
    String? formError;
    bool busy = false;
    await showDialog<void>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (ctx, update) => AlertDialog(
          title: const Text('Add an address'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Label (Home, Work)',
                  ),
                  onChanged: (v) => label = v,
                ),
                const SizedBox(height: 12),
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Street / address',
                  ),
                  onChanged: (v) => address = v,
                ),
                const SizedBox(height: 12),
                TextField(
                  decoration: const InputDecoration(labelText: 'City'),
                  onChanged: (v) => city = v,
                ),
                TextButton.icon(
                  onPressed: busy
                      ? null
                      : () async {
                          update(() => busy = true);
                          try {
                            var permission = await Geolocator.checkPermission();
                            if (permission == LocationPermission.denied)
                              permission = await Geolocator.requestPermission();
                            if (permission == LocationPermission.denied ||
                                permission == LocationPermission.deniedForever)
                              throw Exception(
                                'Allow location access to save a precise delivery point.',
                              );
                            position = await Geolocator.getCurrentPosition();
                            if (c.mounted) update(() => formError = null);
                          } catch (e) {
                            if (c.mounted) update(() => formError = '$e');
                          } finally {
                            if (c.mounted) update(() => busy = false);
                          }
                        },
                  icon: const Icon(Icons.my_location),
                  label: Text(
                    position == null
                        ? 'Use my current location'
                        : 'Location selected',
                  ),
                ),
                if (formError != null) Text(formError!),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.pop(c),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (address.trim().isEmpty) {
                        update(() => formError = 'Enter the address.');
                        return;
                      }
                      update(() => busy = true);
                      try {
                        await widget.api.addAddress(
                          addressLine: address.trim(),
                          city: city.trim(),
                          label: label.trim(),
                          latitude: position?.latitude,
                          longitude: position?.longitude,
                        );
                        if (c.mounted) Navigator.pop(c);
                        await load();
                      } catch (e) {
                        if (c.mounted) update(() => formError = '$e');
                      } finally {
                        if (c.mounted) update(() => busy = false);
                      }
                    },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> change(String method, String path) async {
    try {
      await widget.api.request(
        method,
        path,
        body: method == 'PATCH' ? {} : null,
      );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Delivery addresses')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: add,
      icon: const Icon(Icons.add),
      label: const Text('Add address'),
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (error != null) Text(error!),
              if (rows.isEmpty)
                const Text(
                  'Save your home or work address for faster checkout.',
                ),
              for (final r in rows)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${r['label'] ?? 'Address'}${r['isDefault'] == true ? ' · Default' : ''}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                        Text('${r['addressLine']}\n${r['city'] ?? ''}'),
                        if (r['latitude'] == null)
                          const Text(
                            'Precise location needed for delivery pricing',
                            style: TextStyle(color: Colors.deepOrange),
                          ),
                        Wrap(
                          children: [
                            if (r['isDefault'] != true)
                              TextButton(
                                onPressed: () => change(
                                  'PATCH',
                                  '/v1/customer/addresses/${r['id']}/default',
                                ),
                                child: const Text('Make default'),
                              ),
                            TextButton(
                              onPressed: () async {
                                final ok = await showDialog<bool>(
                                  context: context,
                                  builder: (c) => AlertDialog(
                                    title: const Text('Delete address?'),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(c, false),
                                        child: const Text('Cancel'),
                                      ),
                                      TextButton(
                                        onPressed: () => Navigator.pop(c, true),
                                        child: const Text('Delete'),
                                      ),
                                    ],
                                  ),
                                );
                                if (ok == true)
                                  await change(
                                    'DELETE',
                                    '/v1/customer/addresses/${r['id']}',
                                  );
                              },
                              child: const Text('Delete'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 90),
            ],
          ),
  );
}
