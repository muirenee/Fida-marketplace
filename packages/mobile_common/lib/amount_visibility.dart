bool hasNonZeroAmount(Object? value) {
  final text=value?.toString().trim()??'';
  final amount=num.tryParse(text)??num.tryParse(text.replaceFirst(RegExp(r'\s+[A-Za-z]{3}$'),''));
  return amount!=null&&amount.isFinite&&amount!=0;
}
