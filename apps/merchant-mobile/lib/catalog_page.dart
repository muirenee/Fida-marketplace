import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';

import 'api_client.dart';

class CatalogPage extends StatefulWidget {
  const CatalogPage({
    super.key,
    required this.api,
    required this.tenantId,
    required this.role,
  });
  final MerchantApiClient api;
  final String tenantId, role;
  @override
  State<CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<CatalogPage> {
  List<Map<String, dynamic>> products = [], categories = [];
  bool loading = true, busy = false;
  String? error;
  bool showCategories = false;
  String search = '';
  bool get canEdit => ['OWNER', 'ADMIN', 'MANAGER'].contains(widget.role);
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await Future.wait([
        widget.api.products(widget.tenantId),
        widget.api.categories(widget.tenantId),
      ]);
      if (mounted)
        setState(() {
          products = data[0];
          categories = data[1];
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> mutate(
    String kind,
    Map row,
    String method, [
    Map<String, dynamic>? data,
  ]) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await widget.api.request(
        method,
        '/v1/merchant/$kind/${row['id']}',
        tenantId: widget.tenantId,
        body: data,
      );
      await load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> edit(bool category, [Map<String, dynamic>? row]) async {
    final name = TextEditingController(text: row?['name']?.toString() ?? ''),
        price = TextEditingController(text: row?['price']?.toString() ?? ''),
        description = TextEditingController(
          text: row?['description']?.toString() ?? '',
        );
    String? categoryId = row?['categoryId']?.toString(),
        imageUrl = row?['imageUrl']?.toString();
    bool saving = false;
    String? formError;
    final form = GlobalKey<FormState>();
    await showDialog<void>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (ctx, update) => AlertDialog(
          title: Text(
            '${row == null ? 'Add' : 'Edit'} ${category ? 'category' : 'product'}',
          ),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Form(
                key: form,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Name'),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Enter a name' : null,
                    ),
                    if (!category) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: price,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Price (RWF)',
                        ),
                        validator: (v) {
                          final n = double.tryParse(v ?? '');
                          return n == null || n < 0
                              ? 'Enter a valid price'
                              : null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: description,
                        decoration: const InputDecoration(
                          labelText: 'Description',
                        ),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: categoryId ?? '',
                        decoration: const InputDecoration(
                          labelText: 'Category',
                        ),
                        isExpanded: true,
                        items: [
                          const DropdownMenuItem(
                            value: '',
                            child: Text('Uncategorised'),
                          ),
                          ...categories.map(
                            (c) => DropdownMenuItem(
                              value: c['id'].toString(),
                              child: Text(
                                c['name'].toString(),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ],
                        onChanged: (v) => categoryId = v == '' ? null : v,
                      ),
                      const SizedBox(height: 16),
                      ProductPhoto(
                        url: imageUrl,
                        baseUrl: MerchantApiClient.baseUrl,
                        size: 150,
                      ),
                      TextButton.icon(
                        onPressed: saving
                            ? null
                            : () async {
                                try {
                                  final image = await ImagePicker().pickImage(
                                    source: ImageSource.gallery,
                                    maxWidth: 1600,
                                    maxHeight: 1600,
                                    imageQuality: 85,
                                  );
                                  if (image == null) return;
                                  final bytes = await image.readAsBytes();
                                  if (bytes.length > 5 * 1024 * 1024)
                                    throw Exception(
                                      'Choose a photo smaller than 5 MB.',
                                    );
                                  update(() => saving = true);
                                  final data = await widget.api.request(
                                    'POST',
                                    '/v1/merchant/media',
                                    tenantId: widget.tenantId,
                                    body: {'base64': base64Encode(bytes)},
                                  );
                                  if (ctx.mounted)
                                    update(
                                      () => imageUrl = data['url'].toString(),
                                    );
                                } catch (e) {
                                  if (ctx.mounted)
                                    update(() => formError = '$e');
                                } finally {
                                  if (ctx.mounted) update(() => saving = false);
                                }
                              },
                        icon: const Icon(Icons.add_photo_alternate_outlined),
                        label: Text(
                          imageUrl == null ? 'Add photo' : 'Change photo',
                        ),
                      ),
                      if (imageUrl != null)
                        TextButton(
                          onPressed: saving
                              ? null
                              : () => update(() => imageUrl = null),
                          child: const Text('Remove photo'),
                        ),
                    ],
                    if (formError != null)
                      Text(
                        formError!,
                        style: TextStyle(
                          color: Theme.of(ctx).colorScheme.error,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialog),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (!form.currentState!.validate()) return;
                      update(() => saving = true);
                      try {
                        final kind = category ? 'categories' : 'products';
                        final data = <String, dynamic>{
                          'name': name.text.trim(),
                          if (!category) ...{
                            'price': double.parse(price.text),
                            'description': description.text.trim(),
                            'categoryId': categoryId,
                            'imageUrl': imageUrl,
                          },
                        };
                        var id = row?['id'];
                        if (id == null) {
                          final created = await widget.api.request(
                            'POST',
                            '/v1/merchant/$kind',
                            tenantId: widget.tenantId,
                            body: data,
                          );
                          id = created['id'];
                        } else {
                          await widget.api.request(
                            'PATCH',
                            '/v1/merchant/$kind/$id',
                            tenantId: widget.tenantId,
                            body: data,
                          );
                        }
                        if (dialog.mounted) Navigator.pop(dialog);
                        await load();
                      } catch (e) {
                        if (ctx.mounted)
                          update(() {
                            formError = '$e';
                            saving = false;
                          });
                      }
                    },
              child: Text(saving ? 'Saving…' : 'Save'),
            ),
          ],
        ),
      ),
    );
    // Controllers are owned by this dialog and disposed after its exit animation.
    await Future<void>.delayed(const Duration(milliseconds: 250));
    name.dispose();
    price.dispose();
    description.dispose();
  }

  Future<void> editOptions(Map<String, dynamic> row) async {
    final options = (row['options'] as List? ?? [])
        .map((o) => Map<String, dynamic>.from(o as Map))
        .toList();
    bool saving = false;
    String? formError;
    await showDialog<void>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (ctx, update) => AlertDialog(
          title: const Text('Modifiers & add-ons'),
          content: SizedBox(
            width: 440,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Group choices together, then set required minimum and maximum selections. Leave group empty for optional extras.',
                  ),
                  for (var i = 0; i < options.length; i++)
                    Container(
                      key: ValueKey('choice-$i-${options.length}'),
                      margin: const EdgeInsets.symmetric(vertical: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.black12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          TextFormField(
                            initialValue: options[i]['name']?.toString() ?? '',
                            decoration: const InputDecoration(
                              labelText: 'Choice name',
                            ),
                            onChanged: (v) => options[i]['name'] = v,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: '${options[i]['price'] ?? 0}',
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Additional price',
                            ),
                            onChanged: (v) =>
                                options[i]['price'] = double.tryParse(v),
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: options[i]['group']?.toString() ?? '',
                            decoration: const InputDecoration(
                              labelText: 'Group (optional)',
                              hintText: 'Rice choice',
                            ),
                            onChanged: (v) => update(() {
                              options[i]['group'] = v;
                              options[i]['minSelect'] ??= 0;
                              options[i]['maxSelect'] ??= 1;
                            }),
                          ),
                          if ((options[i]['group'] ?? '')
                              .toString()
                              .isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                for (final k in ['minSelect', 'maxSelect'])
                                  Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.all(4),
                                      child: TextFormField(
                                        initialValue:
                                            '${options[i][k] ?? (k == 'minSelect' ? 0 : 1)}',
                                        keyboardType: TextInputType.number,
                                        decoration: InputDecoration(
                                          labelText: k == 'minSelect'
                                              ? 'Minimum'
                                              : 'Maximum',
                                        ),
                                        onChanged: (v) {
                                          for (final o in options.where(
                                            (o) =>
                                                o['group'] ==
                                                options[i]['group'],
                                          )) {
                                            o[k] = int.tryParse(v);
                                          }
                                        },
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                          TextButton.icon(
                            onPressed: saving
                                ? null
                                : () => update(() => options.removeAt(i)),
                            icon: const Icon(Icons.delete_outline),
                            label: const Text('Remove'),
                          ),
                        ],
                      ),
                    ),
                  TextButton.icon(
                    onPressed: saving || options.length >= 40
                        ? null
                        : () => update(
                            () => options.add({'name': '', 'price': 0}),
                          ),
                    icon: const Icon(Icons.add),
                    label: const Text('Add choice'),
                  ),
                  if (formError != null)
                    Text(formError!, style: const TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialog),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      update(() => saving = true);
                      try {
                        await widget.api.request(
                          'PATCH',
                          '/v1/merchant/products/${row['id']}',
                          tenantId: widget.tenantId,
                          body: {'options': options},
                        );
                        if (dialog.mounted) Navigator.pop(dialog);
                        await load();
                      } catch (e) {
                        if (dialog.mounted) update(() => formError = '$e');
                      } finally {
                        if (dialog.mounted) update(() => saving = false);
                      }
                    },
              child: Text(saving ? 'Saving…' : 'Save choices'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> remove(String kind, Map row) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Delete ${row['name']}?'),
        content: Text(
          kind == 'categories'
              ? 'Products in this category will be hidden from customers. Order history is preserved.'
              : 'This product will be removed from your catalog. Previous orders keep their item details.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) await mutate(kind, row, 'DELETE');
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final kind = showCategories ? 'categories' : 'products';
    final rows = (showCategories ? categories : products)
        .where(
          (r) =>
              r['name'].toString().toLowerCase().contains(search.toLowerCase()),
        )
        .toList();
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          const FidaHero(
            title: 'Make your menu\nstand out.',
            subtitle: 'Fresh photos. Clear choices. More happy customers.',
            icon: Icons.restaurant_rounded,
          ),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(
                value: false,
                label: Text('Products'),
                icon: Icon(Icons.restaurant_menu_rounded),
              ),
              ButtonSegment(
                value: true,
                label: Text('Categories'),
                icon: Icon(Icons.category_outlined),
              ),
            ],
            selected: {showCategories},
            onSelectionChanged: (v) => setState(() => showCategories = v.first),
          ),
          const SizedBox(height: 14),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Search your catalog',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (s) => setState(() => search = s),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${rows.length} $kind',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              if (canEdit)
                FilledButton.icon(
                  onPressed: busy ? null : () => edit(showCategories),
                  icon: const Icon(Icons.add),
                  label: Text(showCategories ? 'Add category' : 'Add product'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (error != null)
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          if (rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Text(
                'No items yet. Add your first item to get started.',
                textAlign: TextAlign.center,
              ),
            ),
          for (final row in rows)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  children: [
                    Row(
                      children: [
                        if (!showCategories) ...[
                          ProductPhoto(
                            url: row['imageUrl']?.toString(),
                            baseUrl: MerchantApiClient.baseUrl,
                          ),
                          const SizedBox(width: 14),
                        ] else ...[
                          const CircleAvatar(
                            backgroundColor: Color(0xFFE9E0FF),
                            child: Icon(
                              Icons.category,
                              color: Color(0xFF7759BA),
                            ),
                          ),
                          const SizedBox(width: 14),
                        ],
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                row['name'].toString(),
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (!showCategories) ...[
                                const SizedBox(height: 6),
                                Text(
                                  '${row['price']} RWF',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  (row['category'] as Map?)?['name']
                                          ?.toString() ??
                                      'Uncategorised',
                                ),
                              ],
                              Text(
                                row['isActive'] == true
                                    ? 'Active'
                                    : 'Suspended',
                                style: TextStyle(
                                  color: row['isActive'] == true
                                      ? const Color(0xFF07855A)
                                      : Colors.deepOrange,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (canEdit) ...[
                      const Divider(height: 24),
                      Wrap(
                        spacing: 8,
                        children: [
                          TextButton.icon(
                            onPressed: busy
                                ? null
                                : () => edit(showCategories, row),
                            icon: const Icon(Icons.edit_outlined),
                            label: const Text('Edit'),
                          ),
                          TextButton(
                            onPressed: busy
                                ? null
                                : () => mutate(kind, row, 'PATCH', {
                                    'isActive': row['isActive'] != true,
                                  }),
                            child: Text(
                              row['isActive'] == true ? 'Suspend' : 'Activate',
                            ),
                          ),
                          if (!showCategories)
                            TextButton(
                              onPressed: busy
                                  ? null
                                  : () => mutate(kind, row, 'PATCH', {
                                      'isAvailable': row['isAvailable'] != true,
                                    }),
                              child: Text(
                                row['isAvailable'] == true
                                    ? 'Mark sold out'
                                    : 'In stock',
                              ),
                            ),
                          if (!showCategories)
                            TextButton(
                              onPressed: busy ? null : () => editOptions(row),
                              child: const Text('Choices'),
                            ),
                          IconButton(
                            tooltip: 'Delete',
                            onPressed: busy ? null : () => remove(kind, row),
                            icon: const Icon(
                              Icons.delete_outline,
                              color: Colors.redAccent,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
