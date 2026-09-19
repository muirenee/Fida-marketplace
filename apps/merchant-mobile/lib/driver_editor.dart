import 'package:flutter/material.dart';

import 'api_client.dart';

Future<bool> editMerchantDriver(
  BuildContext context,
  MerchantApiClient api,
  String tenantId, {
  Map<String, dynamic>? driver,
  List<Map<String, dynamic>> branches = const [],
}) async {
  final user = driver?['user'] as Map? ?? {};
  final values = <String, dynamic>{
    'displayName':
        driver?['displayName'] ??
        [user['firstName'], user['lastName']].whereType<String>().join(' '),
    'firstName': '',
    'lastName': '',
    'email': '',
    'phone': '',
    'password': '',
    'vehiclePlate': driver?['vehiclePlate'] ?? '',
    'vehicleType': driver?['vehicleType'] ?? 'MOTORCYCLE',
    'maxConcurrentOrders': driver?['maxConcurrentOrders'] ?? 3,
    'branchId': driver?['branchId'] ?? '',
  };
  final form = GlobalKey<FormState>();
  bool saving = false;
  String? error;
  return await showDialog<bool>(
        context: context,
        builder: (dialog) => StatefulBuilder(
          builder: (ctx, update) {
            Widget field(
              String key,
              String label, {
              bool required = false,
              bool password = false,
              bool number = false,
            }) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextFormField(
                initialValue: values[key]?.toString() ?? '',
                obscureText: password,
                keyboardType: number
                    ? TextInputType.number
                    : key == 'phone'
                    ? TextInputType.phone
                    : key == 'email'
                    ? TextInputType.emailAddress
                    : TextInputType.text,
                decoration: InputDecoration(labelText: label),
                validator: (v) => required && (v ?? '').trim().isEmpty
                    ? 'Required'
                    : password && (v ?? '').length < 8
                    ? 'At least 8 characters'
                    : number &&
                          (int.tryParse(v ?? '') == null ||
                              int.parse(v!) < 1 ||
                              int.parse(v) > 20)
                    ? 'Enter 1 to 20'
                    : null,
                onChanged: (v) => values[key] = number ? int.tryParse(v) : v,
              ),
            );
            return AlertDialog(
              title: Text(
                driver == null ? 'Create driver account' : 'Edit driver',
              ),
              content: SizedBox(
                width: 420,
                child: SingleChildScrollView(
                  child: Form(
                    key: form,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (driver == null) ...[
                          field('firstName', 'First name', required: true),
                          field('lastName', 'Last name'),
                          field('email', 'Email', required: true),
                          field(
                            'phone',
                            'Phone with country code',
                            required: true,
                          ),
                          field(
                            'password',
                            'Initial password',
                            required: true,
                            password: true,
                          ),
                        ] else ...[
                          field('displayName', 'Display name', required: true),
                          field('vehiclePlate', 'Vehicle plate'),
                          field(
                            'maxConcurrentOrders',
                            'Maximum simultaneous orders',
                            number: true,
                          ),
                          DropdownButtonFormField<String>(
                            initialValue: values['vehicleType'],
                            decoration: const InputDecoration(
                              labelText: 'Vehicle',
                            ),
                            items:
                                [
                                      'MOTORCYCLE',
                                      'BICYCLE',
                                      'CAR',
                                      'VAN',
                                      'WALKING',
                                    ]
                                    .map(
                                      (v) => DropdownMenuItem(
                                        value: v,
                                        child: Text(v.toLowerCase()),
                                      ),
                                    )
                                    .toList(),
                            onChanged: (v) => values['vehicleType'] = v,
                          ),
                        ],
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: values['branchId'],
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Branch scope',
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('All merchant branches'),
                            ),
                            ...branches.map(
                              (b) => DropdownMenuItem(
                                value: b['id'].toString(),
                                child: Text(b['name'].toString()),
                              ),
                            ),
                          ],
                          onChanged: (v) => values['branchId'] = v,
                        ),
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(
                              error!,
                              style: TextStyle(
                                color: Theme.of(ctx).colorScheme.error,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving ? null : () => Navigator.pop(dialog, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: saving
                      ? null
                      : () async {
                          if (!form.currentState!.validate()) return;
                          update(() => saving = true);
                          try {
                            if (driver == null) {
                              await api.request(
                                'POST',
                                '/v1/merchant/drivers/create',
                                tenantId: tenantId,
                                body: values,
                              );
                            } else {
                              await api.request(
                                'PATCH',
                                '/v1/merchant/drivers/${driver['id']}/details',
                                tenantId: tenantId,
                                body: values,
                              );
                              await api.request(
                                'PATCH',
                                '/v1/merchant/drivers/${driver['id']}',
                                tenantId: tenantId,
                                body: {
                                  'branchId': values['branchId'] == ''
                                      ? null
                                      : values['branchId'],
                                },
                              );
                            }
                            if (dialog.mounted) Navigator.pop(dialog, true);
                          } catch (e) {
                            if (ctx.mounted)
                              update(() {
                                error = '$e';
                                saving = false;
                              });
                          }
                        },
                  child: Text(saving ? 'Saving…' : 'Save'),
                ),
              ],
            );
          },
        ),
      ) ??
      false;
}
