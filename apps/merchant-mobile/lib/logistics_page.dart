import 'driver_editor.dart';

import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'package:flutter/material.dart';

import 'api_client.dart';

class MerchantLogisticsPage extends StatefulWidget {
  const MerchantLogisticsPage({
    super.key,
    required this.api,
    required this.tenantId,
    required this.role,
  });

  final MerchantApiClient api;
  final String tenantId;
  final String role;

  @override
  State<MerchantLogisticsPage> createState() => _MerchantLogisticsPageState();
}

class _MerchantLogisticsPageState extends State<MerchantLogisticsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _driverIdentity = TextEditingController();
  final _latitude = TextEditingController();
  final _longitude = TextEditingController();

  List<Map<String, dynamic>> _branches = [];
  List<Map<String, dynamic>> _drivers = [];
  String? _branchId;
  String? _driverBranchId;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  bool get _canAdmin => widget.role == 'OWNER' || widget.role == 'ADMIN';

  Map<String, dynamic>? get _selectedBranch {
    if (_branchId == null) return null;
    for (final branch in _branches) {
      if (branch['id']?.toString() == _branchId) return branch;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void didUpdateWidget(covariant MerchantLogisticsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tenantId != widget.tenantId) _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _driverIdentity.dispose();
    _latitude.dispose();
    _longitude.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final values = await Future.wait([
        widget.api.fulfillment(widget.tenantId),
        widget.api.drivers(widget.tenantId),
      ]);
      if (!mounted) return;
      final branches = values[0];
      final drivers = values[1];
      final nextBranchId =
          branches.any((row) => row['id']?.toString() == _branchId)
          ? _branchId
          : branches.firstOrNull?['id']?.toString();
      setState(() {
        _branches = branches;
        _drivers = drivers;
        _branchId = nextBranchId;
        if (_driverBranchId != null &&
            !branches.any((row) => row['id']?.toString() == _driverBranchId)) {
          _driverBranchId = null;
        }
        _syncLocationFields();
      });
    } on MerchantApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _syncLocationFields() {
    final branch = _selectedBranch;
    _latitude.text = branch?['latitude']?.toString() ?? '';
    _longitude.text = branch?['longitude']?.toString() ?? '';
  }

  Future<void> _saveBranch({bool? pickupEnabled, bool? deliveryEnabled}) async {
    final branch = _selectedBranch;
    if (branch == null || !_canAdmin) return;
    final latitude = _latitude.text.trim().isEmpty
        ? null
        : double.tryParse(_latitude.text.trim());
    final longitude = _longitude.text.trim().isEmpty
        ? null
        : double.tryParse(_longitude.text.trim());
    if ((_latitude.text.trim().isNotEmpty && latitude == null) ||
        (_longitude.text.trim().isNotEmpty && longitude == null)) {
      _message('Enter valid latitude and longitude values.');
      return;
    }

    setState(() => _saving = true);
    try {
      await widget.api.updateBranchFulfillment(
        widget.tenantId,
        branch['id'].toString(),
        pickupEnabled: pickupEnabled ?? branch['pickupEnabled'] == true,
        deliveryEnabled: deliveryEnabled ?? branch['deliveryEnabled'] == true,
        logisticsMode: branch['logisticsMode']?.toString() ?? 'MERCHANT',
        latitude: latitude,
        longitude: longitude,
      );
      await _load();
      _message('Delivery setup updated.');
    } on MerchantApiException catch (e) {
      _message(e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addZone() async {
    final branch = _selectedBranch;
    if (branch == null || !_canAdmin) return;

    final row = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => const _AddDeliveryZoneDialog(),
    );
    if (!mounted || row == null) return;

    final zones =
        ((branch['deliveryZones'] as List? ?? const [])
              .whereType<Map>()
              .map(
                (zone) => <String, dynamic>{
                  'minDistanceKm':
                      double.tryParse(zone['minDistanceKm'].toString()) ?? 0,
                  'maxDistanceKm':
                      double.tryParse(zone['maxDistanceKm'].toString()) ?? 0,
                  'fee': double.tryParse(zone['fee'].toString()) ?? 0,
                },
              )
              .toList())
          ..add(row)
          ..sort(
            (a, b) => (a['minDistanceKm'] as double).compareTo(
              b['minDistanceKm'] as double,
            ),
          );

    await _replaceZones(zones);
  }

  Future<void> _removeZone(int index) async {
    final branch = _selectedBranch;
    if (branch == null || !_canAdmin) return;
    final zones = (branch['deliveryZones'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (zone) => <String, dynamic>{
            'minDistanceKm':
                double.tryParse(zone['minDistanceKm'].toString()) ?? 0,
            'maxDistanceKm':
                double.tryParse(zone['maxDistanceKm'].toString()) ?? 0,
            'fee': double.tryParse(zone['fee'].toString()) ?? 0,
          },
        )
        .toList();
    if (index < 0 || index >= zones.length) return;
    zones.removeAt(index);
    await _replaceZones(zones);
  }

  Future<void> _replaceZones(List<Map<String, dynamic>> zones) async {
    final branch = _selectedBranch;
    if (branch == null) return;
    setState(() => _saving = true);
    try {
      await widget.api.replaceDeliveryZones(
        widget.tenantId,
        branch['id'].toString(),
        zones,
      );
      await _load();
      _message('Delivery distances updated.');
    } on MerchantApiException catch (e) {
      _message(e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _enrollDriver() async {
    if (!_canAdmin) return;
    final identity = _driverIdentity.text.trim();
    if (identity.isEmpty) {
      _message('Enter the driver Fida account email or phone.');
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.api.enrollDriver(
        widget.tenantId,
        emailOrPhone: identity,
        branchId: _driverBranchId,
      );
      _driverIdentity.clear();
      await _load();
      _message('Driver enrolled.');
    } on MerchantApiException catch (e) {
      _message(e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleDriver(Map<String, dynamic> driver) async {
    if (!_canAdmin) return;
    setState(() => _saving = true);
    try {
      await widget.api.updateDriver(
        widget.tenantId,
        driver['id'].toString(),
        isActive: driver['isActive'] != true,
      );
      await _load();
    } on MerchantApiException catch (e) {
      _message(e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _branches.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 160),
            const Icon(Icons.cloud_off_rounded, size: 52),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
          ],
        ),
      );
    }

    return Column(
      children: [
        TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.route_rounded), text: 'Delivery'),
            Tab(icon: Icon(Icons.delivery_dining_rounded), text: 'Drivers'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [_deliveryView(), _driversView()],
          ),
        ),
      ],
    );
  }

  Widget _deliveryView() {
    final branch = _selectedBranch;
    if (_branches.isEmpty)
      return const Center(child: Text('No branches available.'));
    final zones = branch?['deliveryZones'] as List? ?? const [];
    final pickup = branch?['pickupEnabled'] == true;
    final delivery = branch?['deliveryEnabled'] == true;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          Text(
            'Fulfillment',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          const Text(
            'You control pickup, delivery, distance and your own drivers. Fida does not add a customer service fee.',
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _branchId,
            decoration: const InputDecoration(
              labelText: 'Branch',
              border: OutlineInputBorder(),
            ),
            items: _branches
                .map(
                  (row) => DropdownMenuItem(
                    value: row['id'].toString(),
                    child: Text(row['name'].toString()),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() {
              _branchId = value;
              _syncLocationFields();
            }),
          ),
          const SizedBox(height: 14),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  value: pickup,
                  onChanged: !_canAdmin || _saving
                      ? null
                      : (value) => _saveBranch(pickupEnabled: value),
                  secondary: const Icon(Icons.shopping_bag_outlined),
                  title: const Text(
                    'Pickup',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'Customers can collect orders at this branch for free.',
                  ),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  value: delivery,
                  onChanged: !_canAdmin || _saving
                      ? null
                      : (value) => _saveBranch(deliveryEnabled: value),
                  secondary: const Icon(Icons.delivery_dining_rounded),
                  title: const Text(
                    'Merchant delivery',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'Delivery price is selected from your distance bands.',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const Icon(Icons.local_shipping_outlined),
              title: const Text(
                'Logistics operator',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                '${branch?['logisticsMode'] ?? 'MERCHANT'} · Contact your administrator to change the delivery operation.',
              ),
              trailing: const Chip(label: Text('Merchant')),
            ),
          ),
          const SizedBox(height: 22),
          Text(
            'Branch location',
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          const Text(
            'A precise branch location is required for distance-based delivery pricing.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _latitude,
                  enabled: _canAdmin && !_saving,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Latitude',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _longitude,
                  enabled: _canAdmin && !_saving,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Longitude',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: !_canAdmin || _saving ? null : () => _saveBranch(),
            icon: const Icon(Icons.location_on_outlined),
            label: const Text('Save branch location'),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Delivery distance bands',
                  style: Theme.of(context).textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              FilledButton.icon(
                onPressed: !_canAdmin || _saving ? null : _addZone,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add'),
              ),
            ],
          ),
          const SizedBox(height: 5),
          const Text(
            'Set price to 0 for free delivery. Bands may not overlap.',
          ),
          const SizedBox(height: 10),
          if (zones.isEmpty)
            const Card(
              child: ListTile(
                leading: Icon(Icons.route_outlined),
                title: Text('No delivery distances configured'),
                subtitle: Text(
                  'Delivery checkout stays unavailable until at least one distance band exists.',
                ),
              ),
            )
          else
            for (var index = 0; index < zones.length; index++)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.route_rounded)),
                  title: Text(
                    '${zones[index]['minDistanceKm']} – ${zones[index]['maxDistanceKm']} km',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(
                    double.tryParse(zones[index]['fee'].toString()) == 0
                        ? 'Free delivery'
                        : '${zones[index]['fee']} RWF',
                  ),
                  trailing: _canAdmin
                      ? IconButton(
                          onPressed: _saving ? null : () => _removeZone(index),
                          icon: const Icon(Icons.delete_outline_rounded),
                        )
                      : null,
                ),
              ),
          if (!_canAdmin) ...[
            const SizedBox(height: 14),
            const Text(
              'Only merchant owners and admins can change delivery setup.',
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }

  Widget _driversView() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          const FidaHero(
            title: 'Your team.\nReady to deliver.',
            subtitle: 'Create accounts, enroll drivers and manage your fleet.',
            icon: Icons.delivery_dining_rounded,
          ),
          if (_canAdmin)
            FilledButton.icon(
              onPressed: _saving
                  ? null
                  : () async {
                      if (await editMerchantDriver(
                        context,
                        widget.api,
                        widget.tenantId,
                        branches: _branches,
                      ))
                        await _load();
                    },
              icon: const Icon(Icons.person_add),
              label: const Text('Create driver account'),
            ),
          const SizedBox(height: 12),
          Text(
            'Your drivers',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          const Text(
            'Drivers belong to your merchant. Enroll an existing Fida user by their exact email or phone number.',
          ),
          if (_canAdmin) ...[
            const SizedBox(height: 16),
            TextField(
              controller: _driverIdentity,
              enabled: !_saving,
              decoration: const InputDecoration(
                labelText: 'Driver Fida email or phone',
                prefixIcon: Icon(Icons.person_search_rounded),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _driverBranchId ?? '',
              decoration: const InputDecoration(
                labelText: 'Branch scope',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(
                  value: '',
                  child: Text('All merchant branches'),
                ),
                ..._branches.map(
                  (row) => DropdownMenuItem(
                    value: row['id'].toString(),
                    child: Text(row['name'].toString()),
                  ),
                ),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(
                      () => _driverBranchId = value == null || value.isEmpty
                          ? null
                          : value,
                    ),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _saving ? null : _enrollDriver,
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Enroll driver'),
              ),
            ),
          ],
          const SizedBox(height: 22),
          if (_drivers.isEmpty)
            const Card(
              child: ListTile(
                leading: Icon(Icons.delivery_dining_outlined),
                title: Text('No drivers enrolled'),
                subtitle: Text(
                  'Enroll your first driver when you are ready to offer delivery.',
                ),
              ),
            )
          else
            for (final driver in _drivers)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      CircleAvatar(
                        child: Icon(
                          driver['isOnline'] == true
                              ? Icons.delivery_dining_rounded
                              : Icons.person_outline_rounded,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _driverName(driver),
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              (driver['user'] as Map?)?['email']?.toString() ??
                                  (driver['user'] as Map?)?['phone']
                                      ?.toString() ??
                                  'Fida user',
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${(driver['branch'] as Map?)?['name'] ?? 'All branches'} · ${driver['isOnline'] == true ? 'online' : 'offline'} · ${driver['isAvailable'] == true ? 'available' : 'unavailable'}',
                            ),
                          ],
                        ),
                      ),
                      if (_canAdmin)
                        IconButton(
                          tooltip: 'Edit driver',
                          onPressed: _saving
                              ? null
                              : () async {
                                  if (await editMerchantDriver(
                                    context,
                                    widget.api,
                                    widget.tenantId,
                                    driver: driver,
                                    branches: _branches,
                                  ))
                                    await _load();
                                },
                          icon: const Icon(Icons.edit_outlined),
                        ),
                      if (_canAdmin)
                        Switch(
                          value: driver['isActive'] == true,
                          onChanged: _saving
                              ? null
                              : (_) => _toggleDriver(driver),
                        ),
                    ],
                  ),
                ),
              ),
          if (!_canAdmin) ...[
            const SizedBox(height: 14),
            const Text(
              'Only merchant owners and admins can enroll or deactivate drivers.',
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }

  String _driverName(Map<String, dynamic> driver) {
    if ((driver['displayName'] ?? '').toString().isNotEmpty)
      return driver['displayName'].toString();
    final user = driver['user'] as Map? ?? const {};
    final name = [user['firstName'], user['lastName']]
        .where((value) => value != null && value.toString().trim().isNotEmpty)
        .join(' ')
        .trim();
    return name.isNotEmpty
        ? name
        : user['email']?.toString() ?? user['phone']?.toString() ?? 'Driver';
  }
}

class _AddDeliveryZoneDialog extends StatefulWidget {
  const _AddDeliveryZoneDialog();

  @override
  State<_AddDeliveryZoneDialog> createState() => _AddDeliveryZoneDialogState();
}

class _AddDeliveryZoneDialogState extends State<_AddDeliveryZoneDialog> {
  final _formKey = GlobalKey<FormState>();
  String _minText = '0';
  String _maxText = '';
  String _feeText = '';

  double? _number(String value) => double.tryParse(value.trim());

  String? _validateMin(String? value) {
    final number = _number(value ?? '');
    if (number == null) return 'Enter a valid distance.';
    if (number < 0) return 'Distance cannot be negative.';
    return null;
  }

  String? _validateMax(String? value) {
    final number = _number(value ?? '');
    final min = _number(_minText);
    if (number == null) return 'Enter a valid distance.';
    if (min != null && number <= min) return 'Must be greater than From km.';
    return null;
  }

  String? _validateFee(String? value) {
    final number = _number(value ?? '');
    if (number == null) return 'Enter a valid price.';
    if (number < 0) return 'Price cannot be negative.';
    return null;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(<String, dynamic>{
      'minDistanceKm': _number(_minText)!,
      'maxDistanceKm': _number(_maxText)!,
      'fee': _number(_feeText)!,
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add delivery distance'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              initialValue: _minText,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'From km',
                border: OutlineInputBorder(),
              ),
              validator: _validateMin,
              onChanged: (value) => _minText = value,
            ),
            const SizedBox(height: 10),
            TextFormField(
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'To km',
                border: OutlineInputBorder(),
              ),
              validator: _validateMax,
              onChanged: (value) => _maxText = value,
            ),
            const SizedBox(height: 10),
            TextFormField(
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Delivery price (0 = free)',
                border: OutlineInputBorder(),
              ),
              validator: _validateFee,
              onChanged: (value) => _feeText = value,
              onFieldSubmitted: (_) => _submit(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Add')),
      ],
    );
  }
}
