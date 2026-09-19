import 'package:flutter/material.dart';

import '../core/api_client.dart';
import 'merchant_screen.dart';

class SavedScreen extends StatefulWidget {
  const SavedScreen({super.key, required this.api, this.support = false});
  final ApiClient api;
  final bool support;
  @override
  State<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends State<SavedScreen> {
  List rows = [];
  String? error;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await widget.api.request(
        'GET',
        widget.support ? '/v1/customer/support' : '/v1/customer/favorites',
      );
      if (mounted) setState(() => rows = data as List);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.support ? 'Your support cases' : 'Saved favourites'),
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                if (error != null) Text(error!),
                if (rows.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(40),
                    child: Text(
                      widget.support
                          ? 'No support cases yet. Use Get help on an order to contact the merchant.'
                          : 'Save a merchant using the heart on their menu.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                for (final row in rows)
                  Card(
                    child: ListTile(
                      leading: Icon(
                        widget.support ? Icons.support_agent : Icons.favorite,
                        color: const Color(0xFF07855A),
                      ),
                      title: Text(
                        (row[widget.support ? 'subject' : 'name'] ?? '')
                            .toString(),
                      ),
                      subtitle: Text(
                        widget.support
                            ? '${row['status']}\n${row['resolution'] ?? row['description']}'
                            : (row['merchantType'] ?? '')
                                  .toString()
                                  .toLowerCase(),
                      ),
                      isThreeLine: widget.support,
                      onTap: widget.support
                          ? null
                          : () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => MerchantScreen(
                                  api: widget.api,
                                  slug: row['slug'].toString(),
                                ),
                              ),
                            ),
                    ),
                  ),
              ],
            ),
          ),
  );
}
