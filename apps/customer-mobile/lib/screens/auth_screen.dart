import 'package:flutter/material.dart';

import '../core/session_controller.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.session});

  final SessionController session;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _obscure = true;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    if (_register) {
      await widget.session.register(
        firstName: _firstName.text,
        lastName: _lastName.text,
        email: _email.text,
        phone: _phone.text,
        password: _password.text,
      );
    } else {
      await widget.session.login(_email.text, _password.text);
    }
  }

  void _toggleMode() {
    setState(() {
      _register = !_register;
      widget.session.error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.session,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: CustomScrollView(
              slivers: [
                const SliverToBoxAdapter(child: _FoodHero()),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 22, 20, 34),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _register ? 'Create your Fida account' : 'Welcome to Fida',
                            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: -1.05),
                          ),
                          const SizedBox(height: 7),
                          Text(
                            _register ? 'One account for food, groceries and local shopping.' : 'Sign in to order from merchants near you.',
                            style: const TextStyle(fontSize: 16, color: Colors.black54, height: 1.35),
                          ),
                          const SizedBox(height: 22),
                          if (_register) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: _firstName,
                                    textInputAction: TextInputAction.next,
                                    decoration: const InputDecoration(hintText: 'First name'),
                                    validator: (value) => (value ?? '').trim().isEmpty ? 'Required' : null,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: TextFormField(
                                    controller: _lastName,
                                    textInputAction: TextInputAction.next,
                                    decoration: const InputDecoration(hintText: 'Last name'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _phone,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(prefixIcon: Icon(Icons.phone_outlined), hintText: '+250 Mobile number'),
                              validator: (value) {
                                final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
                                return digits.length >= 7 && digits.length <= 15 ? null : 'Enter a valid phone number';
                              },
                            ),
                            const SizedBox(height: 12),
                          ],
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            decoration: const InputDecoration(prefixIcon: Icon(Icons.email_outlined), hintText: 'Email address'),
                            validator: (value) {
                              final text = (value ?? '').trim();
                              return text.contains('@') && text.contains('.') ? null : 'Enter a valid email';
                            },
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _password,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _submit(),
                            decoration: InputDecoration(
                              prefixIcon: const Icon(Icons.lock_outline_rounded),
                              hintText: 'Password',
                              suffixIcon: IconButton(
                                onPressed: () => setState(() => _obscure = !_obscure),
                                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              ),
                            ),
                            validator: (value) => (value ?? '').length < 8 ? 'Use at least 8 characters' : null,
                          ),
                          if (widget.session.error != null) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: const Color(0xFFFFECEC), borderRadius: BorderRadius.circular(12)),
                              child: Text(widget.session.error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w600)),
                            ),
                          ],
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 58,
                            child: FilledButton(
                              onPressed: widget.session.busy ? null : _submit,
                              child: widget.session.busy
                                  ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : Text(_register ? 'Create account' : 'Continue', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                            ),
                          ),
                          const SizedBox(height: 18),
                          Row(
                            children: [
                              const Expanded(child: Divider()),
                              Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text(_register ? 'already registered?' : 'or', style: const TextStyle(color: Colors.black54))),
                              const Expanded(child: Divider()),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 56,
                            child: FilledButton.tonal(
                              onPressed: widget.session.busy ? null : _toggleMode,
                              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF1F1F1), foregroundColor: Colors.black),
                              child: Text(_register ? 'Sign in instead' : 'Create a Fida account', style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
                            ),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'By continuing, you agree to Fida Marketplace terms and privacy policy.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12.5, color: Colors.black54, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FoodHero extends StatelessWidget {
  const _FoodHero();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 270,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFFF8F7F2), Color(0xFFF0F7F2)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
              ),
            ),
          ),
          const Positioned(left: -14, top: 54, child: _FoodBubble(emoji: '🍕', size: 90, angle: -.18)),
          const Positioned(left: 152, top: 56, child: _FoodBubble(emoji: '🍔', size: 112)),
          const Positioned(right: -14, top: 74, child: _FoodBubble(emoji: '🥑', size: 94, angle: .15)),
          const Positioned(left: 20, bottom: 26, child: _FoodBubble(emoji: '🥗', size: 98, angle: -.08)),
          const Positioned(right: 36, bottom: 12, child: _FoodBubble(emoji: '🌮', size: 102, angle: .1)),
          const Positioned(left: 118, top: 88, child: _OfferBadge()),
          const Positioned(right: 78, top: 42, child: _OfferBadge()),
          Positioned(
            top: 18,
            left: 20,
            child: Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(13)),
              child: const Text('F', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }
}

class _FoodBubble extends StatelessWidget {
  const _FoodBubble({required this.emoji, required this.size, this.angle = 0});
  final String emoji;
  final double size;
  final double angle;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: angle,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(size * .34), boxShadow: const [BoxShadow(blurRadius: 15, color: Color(0x11000000))]),
        child: Text(emoji, style: TextStyle(fontSize: size * .55)),
      ),
    );
  }
}

class _OfferBadge extends StatelessWidget {
  const _OfferBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: const Color(0xFFE31C46), borderRadius: BorderRadius.circular(9)),
      child: const Text('%', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
    );
  }
}
