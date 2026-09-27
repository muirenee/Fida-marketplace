import 'package:flutter/material.dart';
import 'delivery_pin_screen.dart';
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

  Future<void> add([Map<String,dynamic>? existing]) async {
    final result=await Navigator.push<Map<String,dynamic>>(context,MaterialPageRoute(builder:(_)=>DeliveryPinScreen(initial:existing??const {})));
    if(result==null||!mounted)return;
    try{await widget.api.request(existing==null?'POST':'PATCH',existing==null?'/v1/customer/addresses':'/v1/customer/addresses/${existing['id']}',body:result);await load();}
    catch(e){if(mounted)setState(()=>error='$e');}
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
      onPressed: () => add(),
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
                            TextButton(onPressed:()=>add(r),child:const Text('Edit / move pin')),
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
