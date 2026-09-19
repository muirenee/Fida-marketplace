import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';

import '../core/api_client.dart';

class OrderActions extends StatefulWidget {
  const OrderActions({super.key, required this.api, required this.order});
  final ApiClient api;
  final Map<String, dynamic> order;
  @override
  State<OrderActions> createState() => _OrderActionsState();
}

class _OrderActionsState extends State<OrderActions> {
  bool busy = false;
  Future<void> action(bool review) async {
    var rating = 5;
    String details = '';
    String? error;
    bool saving = false;
    await showDialog<void>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (ctx, update) => AlertDialog(
          title: Text(
            review ? 'How was your order?' : 'Get help with this order',
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (review)
                Wrap(
                  children: List.generate(
                    5,
                    (i) => IconButton(
                      tooltip: '${i + 1} stars',
                      onPressed: () => update(() => rating = i + 1),
                      icon: Icon(
                        i < rating
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        color: Colors.amber,
                        size: 30,
                      ),
                    ),
                  ),
                ),
              TextField(
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: review
                      ? 'Your review (optional)'
                      : 'Describe the issue',
                ),
                onChanged: (v) => details = v,
              ),
              if (error != null)
                Text(
                  error!,
                  style: TextStyle(color: Theme.of(ctx).colorScheme.error),
                ),
            ],
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
                      if (!review && details.trim().isEmpty) {
                        update(() => error = 'Please describe the issue.');
                        return;
                      }
                      update(() => saving = true);
                      try {
                        await widget.api.request(
                          'POST',
                          '/v1/customer/orders/${widget.order['id']}/${review ? 'review' : 'support'}',
                          body: review
                              ? {'rating': rating, 'comment': details}
                              : {
                                  'subject':
                                      'Order ${widget.order['orderNumber']}',
                                  'description': details,
                                },
                        );
                        if (dialog.mounted) Navigator.pop(dialog);
                        if (mounted)
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                review ? 'Thank you for your review.' : 'Your case has been sent to the merchant.',
                              ),
                            ),
                          );
                      } catch (e) {
                        if (ctx.mounted)
                          update(() {
                            error = '$e';
                            saving = false;
                          });
                      }
                    },
              child: Text(saving ? 'Sending…' : 'Submit'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> refund() async {
    String reason = '';
    final submit = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Request a refund'),
        content: TextField(
          maxLines: 4,
          onChanged: (v) => reason = v,
          decoration: const InputDecoration(labelText: 'Reason'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Submit request'),
          ),
        ],
      ),
    );
    if (submit != true || !mounted) return;
    try {
      await widget.api.request(
        'POST',
        '/v1/customer/orders/${widget.order['id']}/refund',
        body: {'reason': reason},
      );
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Refund request submitted for review.')),
        );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (widget.order['paymentStatus'] == 'PAID')
          TextButton.icon(
            onPressed: refund,
            icon: const Icon(Icons.undo),
            label: const Text('Request refund'),
          ),
        if (widget.order['paymentMethod'] != 'CASH' &&
            widget.order['paymentStatus'] == 'PENDING' &&
            widget.order['status'] == 'PENDING')
          FilledButton.icon(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    try {
                      final p = await widget.api.request(
                        'POST',
                        '/v1/customer/orders/${widget.order['id']}/payment',
                      );
                      if (context.mounted)
                        await openFidaLink(
                          context,
                          Uri.parse(p['url'].toString()),
                        );
                    } catch (e) {
                      if (context.mounted)
                        ScaffoldMessenger.of(context)
                            .showSnackBar(SnackBar(content: Text('$e')));
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
            icon: const Icon(Icons.payments_outlined),
            label: const Text('Complete payment'),
          ),
        if (widget.order['status'] == 'COMPLETED')
          OutlinedButton.icon(
            onPressed: () => action(true),
            icon: const Icon(Icons.star_outline),
            label: const Text('Rate order'),
          ),
        TextButton.icon(
          onPressed: () => action(false),
          icon: const Icon(Icons.support_agent_rounded),
          label: const Text('Get help'),
        ),
      ],
    ),
  );
}
