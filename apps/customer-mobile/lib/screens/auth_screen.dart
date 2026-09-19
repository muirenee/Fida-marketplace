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

  InputDecoration _fieldDecoration({
    required String hintText,
    IconData? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      prefixIcon: prefixIcon == null ? null : Icon(prefixIcon, size: 22),
      suffixIcon: suffixIcon,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      prefixIconConstraints: const BoxConstraints(minWidth: 50, minHeight: 50),
      suffixIconConstraints: const BoxConstraints(minWidth: 50, minHeight: 50),
    );
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
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                const SliverToBoxAdapter(child: _FoodHero()),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _register ? 'Create your Fida account' : 'Welcome to Fida',
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.9,
                              height: 1.08,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _register
                                ? 'One account for food, groceries and local shopping.'
                                : 'Sign in to order from merchants near you.',
                            style: const TextStyle(
                              fontSize: 15.5,
                              color: Colors.black54,
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 18),
                          if (_register) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: _firstName,
                                    textInputAction: TextInputAction.next,
                                    textCapitalization: TextCapitalization.words,
                                    autofillHints: const [AutofillHints.givenName],
                                    decoration: _fieldDecoration(hintText: 'First name'),
                                    validator: (value) =>
                                        (value ?? '').trim().isEmpty ? 'Required' : null,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: TextFormField(
                                    controller: _lastName,
                                    textInputAction: TextInputAction.next,
                                    textCapitalization: TextCapitalization.words,
                                    autofillHints: const [AutofillHints.familyName],
                                    decoration: _fieldDecoration(hintText: 'Last name'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            TextFormField(
                              controller: _phone,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.telephoneNumber],
                              decoration: _fieldDecoration(
                                prefixIcon: Icons.phone_outlined,
                                hintText: '+250 Mobile number',
                              ),
                              validator: (value) {
                                final digits =
                                    (value ?? '').replaceAll(RegExp(r'\D'), '');
                                return digits.length >= 7 && digits.length <= 15
                                    ? null
                                    : 'Enter a valid phone number';
                              },
                            ),
                            const SizedBox(height: 10),
                          ],
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            autofillHints: const [AutofillHints.email],
                            decoration: _fieldDecoration(
                              prefixIcon: Icons.email_outlined,
                              hintText: 'Email address',
                            ),
                            validator: (value) {
                              final text = (value ?? '').trim();
                              return text.contains('@') && text.contains('.')
                                  ? null
                                  : 'Enter a valid email';
                            },
                          ),
                          const SizedBox(height: 10),
                          TextFormField(
                            controller: _password,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            autofillHints: _register
                                ? const [AutofillHints.newPassword]
                                : const [AutofillHints.password],
                            onFieldSubmitted: (_) => _submit(),
                            decoration: _fieldDecoration(
                              prefixIcon: Icons.lock_outline_rounded,
                              hintText: 'Password',
                              suffixIcon: IconButton(
                                tooltip: _obscure ? 'Show password' : 'Hide password',
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 23,
                                ),
                              ),
                            ),
                            validator: (value) => (value ?? '').length < 8
                                ? 'Use at least 8 characters'
                                : null,
                          ),
                          if (widget.session.error != null) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFECEC),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                widget.session.error!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 54,
                            child: FilledButton(
                              onPressed: widget.session.busy ? null : _submit,
                              child: widget.session.busy
                                  ? const SizedBox.square(
                                      dimension: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(
                                      _register ? 'Create account' : 'Continue',
                                      style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 15),
                          Row(
                            children: [
                              const Expanded(child: Divider()),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  _register ? 'already registered?' : 'or',
                                  style: const TextStyle(color: Colors.black54),
                                ),
                              ),
                              const Expanded(child: Divider()),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            height: 52,
                            child: FilledButton.tonal(
                              onPressed:
                                  widget.session.busy ? null : _toggleMode,
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFFF2F2F2),
                                foregroundColor: Colors.black,
                              ),
                              child: Text(
                                _register
                                    ? 'Sign in instead'
                                    : 'Create a Fida account',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'By continuing, you agree to Fida Marketplace terms and privacy policy.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12.5,
                              color: Colors.black54,
                              height: 1.35,
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
      height: 220,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFFBFAF6), Color(0xFFF1F7F2)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          const Positioned(
            left: -16,
            top: 74,
            child: _FoodBubble(emoji: '🍕', size: 76, angle: -.16),
          ),
          const Positioned(
            left: 144,
            top: 58,
            child: _FoodBubble(emoji: '🍔', size: 92),
          ),
          const Positioned(
            right: -10,
            top: 74,
            child: _FoodBubble(emoji: '🥑', size: 78, angle: .12),
          ),
          const Positioned(
            left: 26,
            bottom: 16,
            child: _FoodBubble(emoji: '🥗', size: 82, angle: -.07),
          ),
          const Positioned(
            right: 38,
            bottom: 8,
            child: _FoodBubble(emoji: '🌮', size: 84, angle: .08),
          ),
          const Positioned(left: 116, top: 101, child: _OfferBadge()),
          const Positioned(right: 82, top: 39, child: _OfferBadge()),
          const Positioned(
            left: 20,
            top: 16,
            child: _BrandLockup(),
          ),
        ],
      ),
    );
  }
}

class _BrandLockup extends StatelessWidget {
  const _BrandLockup();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(11),
          ),
          child: const Text(
            'F',
            style: TextStyle(
              color: Colors.white,
              fontSize: 23,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(width: 9),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'FIDA',
              style: TextStyle(
                fontSize: 14,
                height: 1,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.5,
              ),
            ),
            SizedBox(height: 3),
            Text(
              'Marketplace',
              style: TextStyle(
                fontSize: 10.5,
                height: 1,
                color: Colors.black54,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
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
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .96),
          borderRadius: BorderRadius.circular(size * .32),
          border: Border.all(color: const Color(0x0D000000)),
          boxShadow: const [
            BoxShadow(
              blurRadius: 18,
              offset: Offset(0, 6),
              color: Color(0x12000000),
            ),
          ],
        ),
        child: Text(emoji, style: TextStyle(fontSize: size * .52)),
      ),
    );
  }
}

class _OfferBadge extends StatelessWidget {
  const _OfferBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFE31C46),
        borderRadius: BorderRadius.circular(9),
        boxShadow: const [
          BoxShadow(
            blurRadius: 10,
            offset: Offset(0, 4),
            color: Color(0x1FE31C46),
          ),
        ],
      ),
      child: const Text(
        '%',
        style: TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
