import 'dart:async';
import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import '../core/api_client.dart';
import '../ui/format.dart';
import 'merchant_screen.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key, required this.api, this.onAccount});
  final ApiClient api;
  final VoidCallback? onAccount;
  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  final _search = TextEditingController();
  final _searchFocus = FocusNode();
  Timer? _debounce;
  List<Map<String, dynamic>> _merchants = [];
  final List<String> _recent = [];
  final Set<String> _favorites = {};
  final Set<String> _savingFavorites = {};
  bool _loading = true, _offersOnly = false, _openOnly = false;
  String? _error, _type, _city;
  String _mode = 'DELIVERY', _sort = 'name';
  int _request = 0;
  static const _types = [
    ('All', '✨', null),
    ('Restaurants', '🍔', 'RESTAURANT'),
    ('Grocery', '🥬', 'SUPERMARKET'),
    ('Pharmacy', '💊', 'PHARMACY'),
    ('Shops', '🛍️', 'RETAIL'),
  ];
  @override
  void initState() {
    super.initState();
    _load();
    _loadFavorites();
    _loadRecent();
  }

  Future<void> _loadRecent() async {
    try {final rows=await widget.api.request('GET','/v1/customer/recent-stores') as List;if(mounted)setState((){_recent.clear();_recent.addAll(rows.map((r)=>r['tenantId'].toString()));});} catch (_) {}
  }

  Future<void> _loadFavorites() async {
    try {
      final rows =
          await widget.api.request('GET', '/v1/customer/favorites') as List;
      if (mounted)
        setState(() {
          _favorites.clear();
          _favorites.addAll(rows.map((r) => r['id'].toString()));
        });
    } catch (_) {}
  }

  @override
  void dispose() {
    _search.dispose();
    _searchFocus.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final version = ++_request;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.api.merchants(
        type: _type,
        city: _city,
        search: _search.text,
      );
      if (mounted && version == _request) setState(() => _merchants = rows);
    } catch (e) {
      if (mounted && version == _request) setState(() => _error = e.toString());
    } finally {
      if (mounted && version == _request) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visible {
    final rows = _merchants.where((m) {
      final branches = m['branches'] as List? ?? [];
      return branches.any(
            (b) =>
                b[_mode == 'DELIVERY' ? 'deliveryEnabled' : 'pickupEnabled'] ==
                    true &&
                (!_openOnly || b['isOpen'] == true),
          ) &&
          (!_offersOnly || (m['promotions'] as List? ?? []).isNotEmpty);
    }).toList();
    if (_sort == 'rating')
      rows.sort(
        (a, b) => asDouble(b['rating']).compareTo(asDouble(a['rating'])),
      );
    if (_sort == 'minimum')
      rows.sort(
        (a, b) =>
            asDouble(a['minimumOrder']).compareTo(asDouble(b['minimumOrder'])),
      );
    return rows;
  }

  Future<void> _location() async {
    final controller = TextEditingController(text: _city ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Where are you ordering?'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'City',
            hintText: 'Kigali',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, ''),
            child: const Text('All cities'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, controller.text.trim()),
            child: const Text('Show stores'),
          ),
        ],
      ),
    );
    // The dialog owns its field until its closing transition finishes.
    if (result != null && mounted) {
      setState(() => _city = result.isEmpty ? null : result);
      await _load();
    }
  }

  Future<void> _favorite(Map<String, dynamic> m) async {
    final id = m['id'].toString();
    if (_savingFavorites.contains(id)) return;
    setState(() => _savingFavorites.add(id));
    try {
      await widget.api.request(
        _favorites.contains(id) ? 'DELETE' : 'PUT',
        '/v1/customer/favorites/$id',
      );
      if (mounted)
        setState(
          () => _favorites.contains(id)
              ? _favorites.remove(id)
              : _favorites.add(id),
        );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _savingFavorites.remove(id));
    }
  }

  Future<void> _open(Map<String, dynamic> m) async {
    final id=m['id'].toString();setState((){_recent.remove(id);_recent.insert(0,id);});
    unawaited(widget.api.request('POST','/v1/customer/recent-stores/$id',body:<String,dynamic>{}).catchError((_)=><String,dynamic>{}));
    await Navigator.push(context,MaterialPageRoute(builder:(_)=>MerchantScreen(api:widget.api,slug:m['slug'].toString(),initialFulfillment:_mode)));
    if(mounted)await _loadFavorites();
  }
  Widget _card(Map<String, dynamic> m, {bool compact = false}) {
    final promos = m['promotions'] as List? ?? [];
    final branches = m['branches'] as List? ?? [];
    final branch =
        branches
                .where(
                  (b) =>
                      b[_mode == 'DELIVERY'
                          ? 'deliveryEnabled'
                          : 'pickupEnabled'] ==
                      true,
                )
                .firstOrNull
            as Map?;
    final rating = double.tryParse('${m['rating']}');
    final zones = branch?['deliveryZones'] as List? ?? [];
    final fees = zones.map((z) => asDouble(z['fee'])).toList()..sort();
    return InkWell(
      onTap: () => _open(m),
      borderRadius: BorderRadius.circular(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              FoodCover(
                url: m['imageUrl']?.toString(),
                baseUrl: ApiClient.baseUrl,
                height: compact ? 132 : 190,
                label: m['name'].toString(),
              ),
              if (promos.isNotEmpty)
                Positioned(
                  left: 10,
                  top: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF07855A),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      promotionDescription(promos.first as Map, m['currency']?.toString() ?? 'RWF'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              Positioned(
                right: 6,
                bottom: 6,
                child: IconButton.filledTonal(
                  tooltip: 'Save merchant',
                  onPressed: _savingFavorites.contains(m['id'])
                      ? null
                      : () => _favorite(m),
                  icon: Icon(
                    _favorites.contains(m['id'])
                        ? Icons.favorite
                        : Icons.favorite_border,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  m['name'].toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: compact ? 16 : 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (rating != null)
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF2F2F2),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    rating.toStringAsFixed(1),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            _mode == 'PICKUP'
                ? 'Pickup · ${branch?['city'] ?? branch?['name'] ?? 'Local store'}'
                : fees.isEmpty
                ? 'Delivery fee at checkout'
                : 'Delivery from ${money(fees.first, currency: m['currency']?.toString() ?? 'RWF')}',
            style: const TextStyle(color: Colors.black54),
          ),
          const SizedBox(height: 4),
          Text(
            branch?['isOpen'] == false
                ? 'Currently closed · schedule at checkout'
                : rating == null
                ? 'Discover something delicious'
                : '★ ${m['reviewCount']} verified reviews',
            style: TextStyle(
              fontSize: 12,
              color: branch?['isOpen'] == false
                  ? Colors.deepOrange
                  : const Color(0xFF176B55),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String title,List<Map<String,dynamic>> rows,{bool grid=false,String? empty}) {
    final scale=MediaQuery.textScalerOf(context).scale(14)/14;
    return SliverToBoxAdapter(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Padding(padding:const EdgeInsets.fromLTRB(16,24,16,12),child:Text(title,style:const TextStyle(fontSize:22,fontWeight:FontWeight.w800,letterSpacing:-.5))),
      if(rows.isEmpty) Padding(padding:const EdgeInsets.symmetric(horizontal:16,vertical:8),child:Text(empty??'More stores will appear here as local orders and reviews grow.',style:const TextStyle(color:Colors.black54)))
      else if(grid) SizedBox(height:(112+scale*24)*2,child:GridView.builder(padding:const EdgeInsets.symmetric(horizontal:16),scrollDirection:Axis.horizontal,gridDelegate:SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount:2,mainAxisExtent:105,crossAxisSpacing:14,mainAxisSpacing:12),itemCount:rows.length,itemBuilder:(_,i){final m=rows[i];return InkWell(onTap:()=>_open(m),child:Column(children:[SizedBox(width:68,height:68,child:ClipOval(child:FoodCover(url:(m['logoUrl']??m['imageUrl'])?.toString(),baseUrl:ApiClient.baseUrl,height:68,radius:0,label:m['name'].toString()))),const SizedBox(height:6),Text(m['name'].toString(),maxLines:2,overflow:TextOverflow.ellipsis,textAlign:TextAlign.center,style:const TextStyle(fontSize:12,fontWeight:FontWeight.w600))]));}))
      else SizedBox(height:210+scale*90,child:ListView.separated(padding:const EdgeInsets.symmetric(horizontal:16),scrollDirection:Axis.horizontal,itemCount:rows.length.clamp(0,12),separatorBuilder:(_,__)=>const SizedBox(width:14),itemBuilder:(_,i)=>SizedBox(width:MediaQuery.sizeOf(context).width*.68,child:_card(rows[i],compact:true)))),
    ]));
  }
  List<Widget> _discovery(List<Map<String,dynamic>> rows) {
    List<Map<String,dynamic>> ranked(String key)=>rows.where((m)=>asDouble(m[key])>0).toList()..sort((a,b)=>asDouble(b[key]).compareTo(asDouble(a[key])));
    final popular=ranked('completedOrders'),rated=ranked('rating'),favorites=ranked('favoriteCount');
    final recent=_recent.map((id)=>rows.where((m)=>m['id']==id).firstOrNull).whereType<Map<String,dynamic>>().toList();
    final dishes=rows.expand((m)=>(m['dishes'] as List? ?? []).map((p)=>{'merchant':m,'product':p})).toList();
    return [
      _section('Featured on Fida',rows.where((m)=>m['featured']==true).toList(),empty:'Featured stores will appear here.'),
      _section('Recently Viewed',recent,empty:'Open a store to see it here.'),
      _section('Stores near you',rows,grid:true),
      _section('Popular in your area',popular),
      _section('Neighborhood Favorites',favorites),
      _section('Best Overall',rated),
      _section('Most popular local restaurants',popular.where((m)=>m['merchantType']=='RESTAURANT').toList()),
      SliverToBoxAdapter(child:Padding(padding:const EdgeInsets.fromLTRB(16,24,16,12),child:const Text('Discover a new favorite dish',style:TextStyle(fontSize:22,fontWeight:FontWeight.w800,letterSpacing:-.5)))),
      if(dishes.isNotEmpty) SliverToBoxAdapter(child:SizedBox(height:235+MediaQuery.textScalerOf(context).scale(16)*2,child:ListView.separated(padding:const EdgeInsets.symmetric(horizontal:16),scrollDirection:Axis.horizontal,itemCount:dishes.length.clamp(0,20),separatorBuilder:(_,__)=>const SizedBox(width:14),itemBuilder:(_,i){final m=dishes[i]['merchant'] as Map<String,dynamic>,p=dishes[i]['product'] as Map;return SizedBox(width:220,child:InkWell(onTap:()=>_open(m),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[FoodCover(url:p['imageUrl']?.toString(),baseUrl:ApiClient.baseUrl,height:140,label:p['name'].toString()),const SizedBox(height:10),Text(p['name'].toString(),maxLines:2,overflow:TextOverflow.ellipsis,style:const TextStyle(fontSize:16,fontWeight:FontWeight.w700)),Text(money(p['price'],currency:m['currency']?.toString()??'RWF')),Text(m['name'].toString(),maxLines:1,overflow:TextOverflow.ellipsis)])));})))
      else const SliverToBoxAdapter(child:Padding(padding:EdgeInsets.symmetric(horizontal:16),child:Text('Available dishes will appear here.'))),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final rows = _visible;
    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: _location,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      _city ?? 'Choose your city',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 17,
                                      ),
                                    ),
                                  ),
                                  const Icon(Icons.keyboard_arrow_down),
                                ],
                              ),
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Account',
                          onPressed: widget.onAccount,
                          icon: const Icon(Icons.person_outline),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        for (final mode in [
                          ('DELIVERY', 'Delivery', Icons.delivery_dining),
                          ('PICKUP', 'Pickup', Icons.shopping_bag_outlined),
                        ])
                          Expanded(
                            child: InkWell(
                              onTap: () => setState(() => _mode = mode.$1),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                decoration: BoxDecoration(
                                  border: Border(
                                    bottom: BorderSide(
                                      color: _mode == mode.$1
                                          ? Colors.black
                                          : const Color(0xFFEEEEEE),
                                      width: _mode == mode.$1 ? 3 : 1,
                                    ),
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(mode.$3),
                                    const SizedBox(width: 8),
                                    Text(
                                      mode.$2,
                                      style: TextStyle(
                                        fontWeight: _mode == mode.$1
                                            ? FontWeight.w800
                                            : FontWeight.w400,
                                        fontSize: 17,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _search,
                      focusNode: _searchFocus,
                      onChanged: (_) {
                        _debounce?.cancel();
                        _debounce = Timer(
                          const Duration(milliseconds: 350),
                          _load,
                        );
                      },
                      decoration: InputDecoration(
                        hintText: 'Search Fida',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                          tooltip: 'Clear search',
                          onPressed: () {
                            _search.clear();
                            _load();
                          },
                          icon: const Icon(Icons.close),
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(30),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      height: 70 + MediaQuery.textScalerOf(context).scale(12) * 3,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          for (final t in _types)
                            Padding(
                              padding: const EdgeInsets.only(right: 14),
                              child: InkWell(
                                onTap: () {
                                  setState(() => _type = t.$3);
                                  _load();
                                },
                                child: SizedBox(
                                  width: 78,
                                  child: Column(
                                    children: [
                                      Container(
                                        width: 58,
                                        height: 54,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: _type == t.$3
                                              ? const Color(0xFFE2F3DF)
                                              : const Color(0xFFF7F7F7),
                                          borderRadius: BorderRadius.circular(
                                            18,
                                          ),
                                        ),
                                        child: Text(
                                          t.$2,
                                          style: const TextStyle(fontSize: 32),
                                        ),
                                      ),
                                      const SizedBox(height: 7),
                                      Text(
                                        t.$1,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: _type == t.$3
                                              ? FontWeight.w800
                                              : FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          FilterChip(
                            label: const Text('Offers'),
                            avatar: const Icon(
                              Icons.local_offer_outlined,
                              size: 17,
                            ),
                            selected: _offersOnly,
                            onSelected: (v) => setState(() => _offersOnly = v),
                          ),
                          const SizedBox(width: 8),
                          FilterChip(
                            label: const Text('Open now'),
                            selected: _openOnly,
                            onSelected: (v) => setState(() => _openOnly = v),
                          ),
                          const SizedBox(width: 8),
                          PopupMenuButton<String>(
                            onSelected: (v) => setState(() => _sort = v),
                            itemBuilder: (_) => const [
                              PopupMenuItem(
                                value: 'name',
                                child: Text('Store name'),
                              ),
                              PopupMenuItem(
                                value: 'rating',
                                child: Text('Highest rated'),
                              ),
                              PopupMenuItem(
                                value: 'minimum',
                                child: Text('Lowest minimum order'),
                              ),
                            ],
                            child: const Chip(
                              label: Text('Sort'),
                              avatar: Icon(Icons.tune, size: 18),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SectionHeading(
                      _search.text.isNotEmpty
                          ? 'Search results'
                          : _offersOnly
                          ? 'Offers for you'
                          : 'Discover on Fida',
                      subtitle: _loading
                          ? 'Finding your next favourite…'
                          : '${rows.length} stores · ${_mode == 'DELIVERY' ? 'Delivery' : 'Pickup'}',
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverToBoxAdapter(
              child: LinearProgressIndicator(minHeight: 2),
            ),
          if (_error != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Icon(Icons.wifi_off, size: 40),
                    Text(_error!),
                    TextButton(
                      onPressed: _load,
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
            )
          else if (!_loading && rows.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No stores match. Try another city, category or filter.',
                ),
              ),
            )
          else ...[
            if(_search.text.isEmpty) ..._discovery(rows),
            SliverToBoxAdapter(child:Padding(padding:const EdgeInsets.fromLTRB(16,20,16,12),child:Text(_search.text.isEmpty?'All Stores':'Search results',style:const TextStyle(fontSize:22,fontWeight:FontWeight.w800)))),
            SliverPadding(padding:const EdgeInsets.fromLTRB(16,0,16,28),sliver:SliverList.separated(itemCount:rows.length,separatorBuilder:(_,__)=>const SizedBox(height:26),itemBuilder:(_,i)=>_card(rows[i]))),
          ],
        ],
      ),
    );
  }
}
