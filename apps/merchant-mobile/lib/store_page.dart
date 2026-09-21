import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'api_client.dart';

class StorePage extends StatefulWidget {
  const StorePage({super.key, required this.api, required this.tenantId});
  final MerchantApiClient api;
  final String tenantId;
  @override
  State<StorePage> createState() => _StorePageState();
}

class _StorePageState extends State<StorePage> {
  final fields = <String, TextEditingController>{
    for (final key in ['name', 'legalName', 'taxId', 'timezone', 'cuisineTags'])
      key: TextEditingController(),
  };
  Map<String, dynamic>? store;
  bool busy = true;
  String? error;
  Future<dynamic> call(String path, {String method = 'GET', Object? body}) =>
      widget.api.request(method, '/v1/merchant/store$path',
          tenantId: widget.tenantId, body: body);
  @override
  void initState() { super.initState(); load(); }
  @override
  void dispose() { for (final c in fields.values) { c.dispose(); } super.dispose(); }
  Future<void> load() async {
    try {
      final data = Map<String, dynamic>.from(await call(''));
      if (!mounted) return;
      for (final entry in fields.entries) {
        entry.value.text = entry.key == 'cuisineTags'
            ? (data[entry.key] as List? ?? []).join(', ')
            : '${data[entry.key] ?? ''}';
      }
      setState(() { store = data; error = null; });
    } catch (e) { if (mounted) setState(() => error = '$e'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> upload(String key) async {
    setState(() => busy = true);
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null) return;
      if (await file.length() > 5 * 1024 * 1024) {
        throw MerchantApiException('Choose an image up to 5 MB.');
      }
      final bytes = await file.readAsBytes();
      final url = await widget.api.uploadBranding(bytes);
      if (mounted) setState(() { store![key] = url; error = null; });
    } catch (e) { if (mounted) setState(() => error = '$e'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> save() async {
    setState(() => busy = true);
    try {
      await call('', method: 'PATCH', body: {
        for (final e in fields.entries)
          e.key: e.key == 'cuisineTags'
              ? e.value.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList()
              : e.value.text.trim(),
        for (final key in ['merchantType', 'logoUrl', 'coverUrl']) key: store![key],
      });
      await load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Store updated')));
    } catch (e) { if (mounted) setState(() => error = '$e'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> editBranch(Map branch) async {
    final controls = {
      for (final key in ['name', 'addressLine', 'city', 'latitude', 'longitude'])
        key: TextEditingController(text: '${branch[key] ?? ''}'),
    };
    final flags = {for (final key in ['isActive', 'isAcceptingOrders', 'pickupEnabled', 'deliveryEnabled']) key: branch[key] == true};
    String? message;
    bool saving = false;
    await showDialog<void>(context: context, builder: (c) => StatefulBuilder(builder: (c, update) => AlertDialog(
      title: const Text('Edit branch'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        for (final e in controls.entries) Padding(padding: const EdgeInsets.only(bottom: 12), child: TextField(
          controller: e.value, decoration: InputDecoration(labelText: {'name':'Branch name','addressLine':'Street address','city':'City','latitude':'Latitude','longitude':'Longitude'}[e.key]),
          keyboardType: ['latitude','longitude'].contains(e.key) ? const TextInputType.numberWithOptions(decimal: true, signed: true) : TextInputType.text,
        )),
        for (final key in flags.keys) SwitchListTile(contentPadding: EdgeInsets.zero,
          title: Text({'isActive':'Active branch','isAcceptingOrders':'Accept orders','pickupEnabled':'Pickup','deliveryEnabled':'Delivery'}[key]!),
          value: flags[key]!, onChanged: saving ? null : (v) => update(() => flags[key] = v)),
        if (message != null) Text(message!, style: TextStyle(color: Theme.of(c).colorScheme.error)),
      ])),
      actions: [TextButton(onPressed: saving ? null : () => Navigator.pop(c), child: const Text('Cancel')),
        FilledButton(onPressed: saving ? null : () async {
          update(() => saving = true);
          try {
            final coordinates = <String, double>{};
            for (final key in ['latitude', 'longitude']) {
              final value = double.tryParse(controls[key]!.text.trim());
              if (value == null || !value.isFinite || value.abs() > (key == 'latitude' ? 90 : 180)) {
                throw MerchantApiException('Enter valid latitude and longitude.');
              }
              coordinates[key] = value;
            }
            await call('/branches/${branch['id']}', method: 'PATCH', body: {
              for (final key in ['name', 'addressLine', 'city']) key: controls[key]!.text.trim(), ...coordinates, ...flags,
            });
            if (c.mounted) Navigator.pop(c);
            await load();
          } catch (e) { if (c.mounted) update(() => message = '$e'); }
          finally { if (c.mounted) update(() => saving = false); }
        }, child: Text(saving ? 'Saving…' : 'Save'))],
    )));
    // Dialog fields remain mounted during the closing animation.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    for (final controller in controls.values) { controller.dispose(); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Store and branches')),
    body: ListView(padding: const EdgeInsets.all(20), children: [
      if (busy) const LinearProgressIndicator(),
      if (error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      if (store == null && !busy) OutlinedButton(onPressed: load, child: const Text('Retry')),
      if (store != null) ...[
        Text('Store URL: ${store!['slug']}', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 16),
        for (final e in fields.entries) Padding(padding: const EdgeInsets.only(bottom: 16), child: TextField(
          enabled: !busy, controller: e.value, decoration: InputDecoration(labelText: {'name':'Store name','legalName':'Legal entity','taxId':'Tax ID','timezone':'Time zone','cuisineTags':'Cuisine / category tags (comma separated)'}[e.key]),
        )),
        DropdownButtonFormField<String>(initialValue: store!['merchantType'] as String,
          decoration: const InputDecoration(labelText: 'Business type'),
          items: [for (final type in ['RESTAURANT','SUPERMARKET','PHARMACY','RETAIL','OTHER']) DropdownMenuItem(value: type, child: Text(type))],
          onChanged: busy ? null : (v) => setState(() => store!['merchantType'] = v)),
        const SizedBox(height: 16),
        for (final key in ['logoUrl','coverUrl']) ...[
          if ((store![key] ?? '').toString().isNotEmpty) ValueListenableBuilder<int>(
            valueListenable: FidaEndpoints.changes,
            builder: (_, __, ___) => Image.network(
            FidaEndpoints.mediaUri(MerchantApiClient.baseUrl, store![key].toString()),
            height: key == 'logoUrl' ? 90 : 160, fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const SizedBox(height: 40, child: Center(child: Text('Image unavailable'))))),
          OutlinedButton.icon(onPressed: busy ? null : () => upload(key), icon: const Icon(Icons.photo_library_outlined), label: Text(key == 'logoUrl' ? 'Upload logo' : 'Upload cover photo')),
        ],
        FilledButton(onPressed: busy ? null : save, child: const Text('Save store')),
        const SizedBox(height: 24), Text('Branches', style: Theme.of(context).textTheme.titleLarge),
        for (final branch in store!['branches'] as List) ListTile(contentPadding: EdgeInsets.zero,
          title: Text('${branch['name']}'), subtitle: Text('${branch['city'] ?? ''} · ${branch['isActive'] == true ? 'Active' : 'Suspended'}'),
          trailing: const Icon(Icons.edit_outlined), onTap: busy ? null : () => editBranch(branch as Map)),
      ],
    ]),
  );
}
