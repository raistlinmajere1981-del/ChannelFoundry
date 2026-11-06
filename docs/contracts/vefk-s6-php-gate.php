<?php
declare(strict_types=1);
/**
 * S6 reference gate: opt-in, read-only. NOT installed in any live site.
 * Call with json_decode(raw incoming publication JSON, false, 512,
 * JSON_THROW_ON_ERROR), preserving {} vs [] for canonical SHA-256.
 * All errors are exceptions; the host endpoint decides HTTP status.
 */
function vefk_s6_require(bool $condition, string $reason): void {
    if (!$condition) throw new DomainException('Vefk S6: ' . $reason);
}
function vefk_s6_object(mixed $value, string $label): stdClass {
    vefk_s6_require($value instanceof stdClass, $label . ' nesnesi eksik');
    return $value;
}
function vefk_s6_array(mixed $value, string $label, int $max): array {
    vefk_s6_require(is_array($value) && count($value) <= $max, $label . ' liste sınırı geçersiz');
    return $value;
}
function vefk_s6_hash(mixed $value): bool {
    return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1;
}
function vefk_s6_text(mixed $value, string $name, int $max, bool $required=false): void {
    vefk_s6_require(is_string($value), $name . ' metni geçersiz');
    // JS S1 validates String.length (UTF-16 code units), not Unicode code points.
    // A supplementary character is two UTF-16 units. No mbstring dependency.
    $points=preg_match_all('/./us',$value);
    $supplementary=preg_match_all('/[\\x{10000}-\\x{10FFFF}]/u',$value);
    vefk_s6_require($points!==false && $supplementary!==false &&
        $points+$supplementary <= $max &&
        (!$required || preg_match('/[^\\p{Z}\\s\\x{FEFF}]/u',$value) === 1),
        $name . ' metni geçersiz');
}
function vefk_s6_id(mixed $value): bool {
    return is_string($value) && preg_match('/^[A-Za-z][A-Za-z0-9._-]{0,119}$/D', $value) === 1;
}
function vefk_s6_canonical(mixed $value): mixed {
    if (is_array($value)) return array_map('vefk_s6_canonical', $value);
    if (!($value instanceof stdClass)) return $value;
    $sorted = get_object_vars($value);
    ksort($sorted, SORT_STRING);
    $out = new stdClass();
    foreach ($sorted as $key => $entry) $out->{$key} = vefk_s6_canonical($entry);
    return $out;
}
function vefk_s6_json(mixed $value): string {
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES |
        JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
}
function vefk_s6_sha(mixed $value): string {
    return hash('sha256', vefk_s6_json(vefk_s6_canonical($value)));
}
function vefk_s6_pretty(mixed $value, int $level = 0): string {
    if (!is_array($value) && !($value instanceof stdClass)) return vefk_s6_json($value);
    $object = $value instanceof stdClass;
    $items = $object ? get_object_vars($value) : $value;
    if (!$items) return $object ? '{}' : '[]';
    $pad = str_repeat('  ', $level + 1);
    $lines = [];
    foreach ($items as $key => $entry) {
        $prefix = $object ? vefk_s6_json((string)$key) . ': ' : '';
        $lines[] = $pad . $prefix . vefk_s6_pretty($entry, $level + 1);
    }
    return ($object ? '{' : '[') . "\n" . implode(",\n", $lines) . "\n" .
        str_repeat('  ', $level) . ($object ? '}' : ']');
}
function vefk_s6_keys(stdClass $object, array $allowed, string $label): void {
    foreach (array_keys(get_object_vars($object)) as $key) {
        vefk_s6_require(in_array($key, $allowed, true), $label . ' tanımsız alan: ' . $key);
    }
}
function vefk_s6_path(string $d, array $box): void {
    vefk_s6_require(strlen($d) >= 4 && strlen($d) <= 8192, 'SVG yol uzunluğu geçersiz');
    vefk_s6_require(preg_match('/^[MLZ0-9.+\-\s]+$/D', $d) === 1, 'SVG yol grameri güvensiz');
    preg_match_all('/[MLZ]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)/', $d, $match);
    $tokens = $match[0];
    vefk_s6_require(count($tokens) <= 4096 &&
        implode('', $tokens) === preg_replace('/\s+/', '', $d), 'SVG yol tokenları geçersiz');
    $hasMove = false; $drawn = false; $i = 0; $count=count($tokens);
    while ($i < $count) {
        $op=$tokens[$i++];
        if ($op === 'Z') {
            vefk_s6_require($hasMove, 'Z öncesinde M gerekli');
            $hasMove=false;
            continue;
        }
        vefk_s6_require(($op==='M'||$op==='L') && ($op!=='L'||$hasMove), 'SVG M/L sırası geçersiz');
        vefk_s6_require($i+1 < $count, 'SVG koordinatları eksik');
        // PHP casts command letters to 0; JS Number() rejects them as NaN.
        vefk_s6_require(is_numeric($tokens[$i]) && is_numeric($tokens[$i+1]),
            'SVG koordinat tokenları sayı olmalı');
        $x=(float)$tokens[$i++]; $y=(float)$tokens[$i++];
        vefk_s6_require(is_finite($x) && is_finite($y) &&
            abs($x)<=100000 && abs($y)<=100000 &&
            $x >= $box[0]-.0001 && $x <= $box[0]+$box[2]+.0001 &&
            $y >= $box[1]-.0001 && $y <= $box[1]+$box[3]+.0001,
            'SVG koordinatları viewBox dışında');
        if ($op==='M') $hasMove=true;
        else $drawn=true;
    }
    vefk_s6_require($drawn, 'SVG görünür çizgi içermeli');
    vefk_s6_require(trim(preg_replace('/\\s+/', ' ', $d)) === $d,
       'SVG yolu S1 normalizasyonuna uymuyor');
}

/** Matches Studio S1's deterministic construction proof, not only its hashes. */
function vefk_s6_safe_int(mixed $v, string $label): int {
    vefk_s6_require(is_int($v) && abs($v) <= 9007199254740991,
        $label . ' güvenli tam sayı değil');
    return $v;
}
function vefk_s6_numeric_grid(mixed $raw, int $min, int $max): array {
    $grid=vefk_s6_array($raw,'construction.grid',9);
    $order=count($grid);
    vefk_s6_require($order >= $min && $order <= $max,
        'Vefk sıra boyutu geçersiz');
    foreach ($grid as $row) {
        vefk_s6_require(is_array($row) && count($row)===$order,
            'Vefk satır uzunluğu yanlış');
        foreach ($row as $value)vefk_s6_safe_int($value,'grid cell');
    }
    return $grid;
}
function vefk_s6_sum(array $items, string $label): int {
    $sum=0;
    foreach ($items as $item) {
        $sum += $item;
        vefk_s6_require(is_int($sum) && abs($sum)<=9007199254740991,
            $label . ' toplam sınırını aştı');
    }
    return $sum;
}
function vefk_s6_construction(stdClass $c): ?array {
    $kind=$c->kind ?? null;
    vefk_s6_require(is_string($kind) &&
        in_array($kind,['magicSquare','manualSquare','manualPaths'],true),
        'construction.kind geçersiz');
    $algorithm = $kind==='magicSquare'?'siamese-odd':'manual';
    vefk_s6_require(($c->algorithmId ?? null)===$algorithm &&
        ($c->algorithmVersion ?? null)==='1',
        'construction algorithmId/version uyuşmuyor');
    $params=vefk_s6_object($c->parameters ?? null,'construction.parameters');
    $checks=vefk_s6_object($c->checks ?? null,'construction.checks');
    if($kind==='manualPaths') {
        vefk_s6_require(!property_exists($c,'grid') &&
            count(get_object_vars($params))===0,
            'manualPaths matris/parametre içeremez');
        $expected=(object)['passed'=>true,'verification'=>'geometry-only'];
        vefk_s6_require(vefk_s6_sha($checks)===vefk_s6_sha($expected),
            'manualPaths checks uyuşmuyor');
        return null;
    }
    if($kind==='manualSquare'){
        $grid=vefk_s6_numeric_grid($c->grid ?? null,1,9);
        $expectedParams=(object)['order'=>count($grid)];
        $expectedChecks=(object)['passed'=>true,'verification'=>'structure-only'];
        vefk_s6_require(vefk_s6_sha($params)===vefk_s6_sha($expectedParams) &&
            vefk_s6_sha($checks)===vefk_s6_sha($expectedChecks),
            'manualSquare parametre/rapor uyuşmuyor');
        return $grid;
    }
    vefk_s6_require(is_int($params->order ?? null) &&
        in_array($params->order,[3,5,7],true),
        'Siamese sıra değeri geçersiz');
    $n=$params->order;
    $first=vefk_s6_safe_int($params->first ?? null,'first');
    $step=vefk_s6_safe_int($params->step ?? null,'step');
    vefk_s6_require($step!==0,'Siamese adımı sıfır olamaz');
    $last=$first+$step*($n*$n-1);
    vefk_s6_safe_int($last,'last');
    $sumFirstLast=$first+$last;
    vefk_s6_require(is_int($sumFirstLast) && $sumFirstLast%2===0,
        'Siamese arithmetic precision');
    $magic=$n*intdiv($sumFirstLast,2);
    vefk_s6_safe_int($magic,'magic sum');
    $expectedParams=(object)['order'=>$n,'first'=>$first,'step'=>$step];
    vefk_s6_require(vefk_s6_sha($params)===vefk_s6_sha($expectedParams),
        'Siamese parametreleri normalleştirilmemiş');
    $grid=vefk_s6_numeric_grid($c->grid ?? null,$n,$n);
    $expected=array_fill(0,$n,array_fill(0,$n,null));
    $row=0;$column=intdiv($n,2);
    for($i=0;$i<$n*$n;$i++){
        $value=$first+$i*$step;
        vefk_s6_safe_int($value,'generated cell');
        $expected[$row][$column]=$value;
        $up=($row-1+$n)%$n;
        $left=($column-1+$n)%$n;
        if($expected[$up][$left]!==null) $row=($row+1)%$n;
        else {$row=$up;$column=$left;}
    }
    vefk_s6_require(vefk_s6_sha($grid)===vefk_s6_sha($expected),
        'Siamese matematiksel kare veya hücre dizilimi bozuk');
    $rowSums=[];$columnSums=[];
    for($i=0;$i<$n;$i++) {
        $rowSums[]=vefk_s6_sum($grid[$i],'row');
        $col=[];
        for($r=0;$r<$n;$r++)$col[]=$grid[$r][$i];
        $columnSums[]=vefk_s6_sum($col,'column');
    }
    $diagonals=[[],[]];
    for($r=0;$r<$n;$r++) {
        $diagonals[0][]=$grid[$r][$r];
        $diagonals[1][]=$grid[$r][$n-1-$r];
    }
    $diagonalSums=[
        vefk_s6_sum($diagonals[0],'diagonal'),
        vefk_s6_sum($diagonals[1],'diagonal'),
    ];
    foreach(array_merge($rowSums,$columnSums,$diagonalSums) as $sum)
        vefk_s6_require($sum===$magic,'Siamese satır/sütun/çapraz toplam bozuk');
    $expectedChecks=(object)[
        'rowSums'=>$rowSums,'columnSums'=>$columnSums,
        'diagonalSums'=>$diagonalSums,'expectedSum'=>$magic,'passed'=>true,
    ];
    vefk_s6_require(vefk_s6_sha($checks)===vefk_s6_sha($expectedChecks),
        'Siamese hesap raporu uyuşmuyor');
    return $grid;
}

function vefk_s6_document(stdClass $doc): void {
    vefk_s6_require(($doc->format ?? null)==='birdesengor.vefk' &&
        in_array($doc->schemaVersion ?? null,[1,2],true) && vefk_s6_id($doc->id ?? null) &&
        is_int($doc->revision ?? null) && $doc->revision>=1, 'Belge sürümü/kimliği geçersiz');
    vefk_s6_keys($doc, ['format','schemaVersion','id','revision','title','description',
        'language','provenance','construction','geometry','drawPlan','accessibility','contentHash','generatedAt'], 'Belge');
    vefk_s6_require(vefk_s6_hash($doc->contentHash ?? null), 'Belge hash biçimi geçersiz');
    vefk_s6_text($doc->title ?? null,'title',300,true);
    vefk_s6_text($doc->description ?? null,'description',4000);
    vefk_s6_text($doc->language ?? null,'language',20,true);
    if (property_exists($doc,'generatedAt')) {
        vefk_s6_require(is_string($doc->generatedAt) && strtotime($doc->generatedAt)!==false,
            'generatedAt geçersiz');
    }
    $provenance=vefk_s6_object($doc->provenance ?? null,'provenance');
    vefk_s6_keys($provenance,['kind','references','notes'],'provenance');
    vefk_s6_require(in_array($provenance->kind ?? null,
      ['manual','traditional-reference','algorithmic'],true),'provenance.kind geçersiz');
    foreach (vefk_s6_array($provenance->references ?? null,'references',100) as $ref)
      vefk_s6_text($ref,'reference',400,true);
    vefk_s6_text($provenance->notes ?? null,'notes',4000);
    $construction=vefk_s6_object($doc->construction ?? null,'construction');
    vefk_s6_keys($construction,['kind','algorithmId','algorithmVersion','parameters','grid','checks'],'construction');
    $grid=vefk_s6_construction($construction);
    $a11y=vefk_s6_object($doc->accessibility ?? null,'accessibility');
    vefk_s6_keys($a11y,['summary','matrixText'],'accessibility');
    vefk_s6_text($a11y->summary ?? null,'accessibility.summary',2000,true);
    vefk_s6_text($a11y->matrixText ?? null,'accessibility.matrixText',5000);
    $geo=vefk_s6_object($doc->geometry ?? null,'geometry');
    vefk_s6_keys($geo,['coordinateSpace','viewBox','paths','inkStyles'],'geometry');
    $box=vefk_s6_array($geo->viewBox ?? null,'viewBox',4);
    vefk_s6_require(count($box)===4 && ($geo->coordinateSpace ?? null)==='svg-viewBox' &&
        array_reduce($box,fn($carry,$value)=>$carry && (is_int($value)||is_float($value)) && is_finite((float)$value),true)
        && $box[2]>0 && $box[3]>0 &&
        array_reduce($box, fn($carry,$value)=>$carry && abs($value)<=100000, true),
        'viewBox geçersiz');
    $paths=vefk_s6_array($geo->paths ?? null,'paths',1024);
    vefk_s6_require(count($paths)>0, 'Boş SVG yolları');
    $styles=vefk_s6_object($geo->inkStyles ?? null,'inkStyles');
    vefk_s6_require(count(get_object_vars($styles))<=32, 'Mürekkep stili sınırı');
    foreach (get_object_vars($styles) as $name => $style) {
        vefk_s6_require(vefk_s6_id($name), 'Mürekkep stil kimliği');
        $style=vefk_s6_object($style,'inkStyle');
        vefk_s6_keys($style,['width','cap'],'inkStyle');
        vefk_s6_require((is_int($style->width ?? null)||is_float($style->width ?? null)) && is_finite((float)$style->width) &&
          $style->width>=0.01 && $style->width<=100 &&
          in_array($style->cap ?? null,['round','square','butt'],true),'Mürekkep stili geçersiz');
    }
    $byId=[]; $semantic=[];
    foreach ($paths as $path) {
        $path=vefk_s6_object($path,'path');
        vefk_s6_keys($path,['id','d','ink','semanticValue'],'path');
        vefk_s6_require(vefk_s6_id($path->id ?? null) && !isset($byId[$path->id]) &&
            vefk_s6_id($path->ink ?? null) && isset($styles->{$path->ink}) &&
            is_string($path->d ?? null),'Yol kimliği/stili geçersiz');
        if (property_exists($path,'semanticValue'))
            vefk_s6_text($path->semanticValue,'path.semanticValue',120);
        $byId[$path->id]=$path->ink;
        $semantic[$path->id]=$path->semanticValue ?? null;
        vefk_s6_path($path->d,$box);
    }
    if ($grid!==null) {
        foreach ($grid as $r=>$row) foreach ($row as $c=>$value) {
            $cell='cell.r'.$r.'c'.$c;
            vefk_s6_require(array_key_exists($cell,$semantic) &&
                $semantic[$cell]===(string)$value,
                'Vefk hücre numarası/SVG anlamı uyuşmuyor: '.$cell);
        }
    }
    $plan=vefk_s6_object($doc->drawPlan ?? null,'drawPlan');
    vefk_s6_keys($plan,['timeUnit','durationMs','markers','strokes'],'drawPlan');
    $duration=$plan->durationMs ?? null;
    vefk_s6_require(($plan->timeUnit ?? null)==='ms' && is_int($duration) &&
       $duration>=1 && $duration<=3600000,'Toplam çizim süresi geçersiz');
    $strokes=vefk_s6_array($plan->strokes ?? null,'strokes',1024);
    vefk_s6_require(count($strokes)===count($paths),'Stroke sayısı yollardan farklı');
    $seen=[]; $strokeIds=[]; $end=0;
    foreach ($strokes as $stroke) {
        $stroke=vefk_s6_object($stroke,'stroke');
        $strokeKeys=['id','pathId','startMs','durationMs','ink','pen'];
        if ($doc->schemaVersion===2) $strokeKeys[]='easing';
        vefk_s6_keys($stroke,$strokeKeys,'stroke');
        if (property_exists($stroke,'easing')) {
            vefk_s6_require(in_array($stroke->easing,
                ['linear','ease-in','ease-out','ease-in-out'],true),'Stroke easing geçersiz');
        }
        $id=$stroke->pathId ?? null;
        vefk_s6_require(vefk_s6_id($stroke->id ?? null) && !isset($strokeIds[$stroke->id]) && is_string($id) &&
            isset($byId[$id]) && !isset($seen[$id]) &&
            ($stroke->ink ?? null)===$byId[$id] && ($stroke->pen ?? null)==='down' &&
            is_int($stroke->startMs ?? null) && is_int($stroke->durationMs ?? null) &&
            $stroke->startMs>=$end && $stroke->durationMs>0 &&
            $stroke->startMs+$stroke->durationMs<=$duration,
            'Stroke sırası/süresi geçersiz');
        $end=$stroke->startMs+$stroke->durationMs;$seen[$id]=true;
        $strokeIds[$stroke->id]=true;
    }
    $markers=vefk_s6_array($plan->markers ?? null,'markers',64);
    $markerIds=[];$lastMarker=-1;
    foreach ($markers as $marker) {
        $marker=vefk_s6_object($marker,'marker');
        vefk_s6_keys($marker,['id','atMs'],'marker');
        vefk_s6_require(vefk_s6_id($marker->id ?? null) &&
           !isset($markerIds[$marker->id]) &&
           is_int($marker->atMs ?? null) && $marker->atMs>=0 && $marker->atMs>=$lastMarker &&
           $marker->atMs<=$duration,'Zaman işareti geçersiz');
        $markerIds[$marker->id]=true;$lastMarker=$marker->atMs;
    }
    $meaning=new stdClass();
    foreach (['format','schemaVersion','id','revision','title','description','language',
       'provenance','construction','geometry','drawPlan','accessibility'] as $field) {
        vefk_s6_require(property_exists($doc,$field),'Eksik semantik belge alanı: '.$field);
        $meaning->{$field}=$doc->{$field};
    }
    vefk_s6_require(hash_equals($doc->contentHash,vefk_s6_sha($meaning)), 'Belge contentHash uyuşmuyor');
}

/**
 * Accepts the exact typed JSON value of the *inner* publication (not the
 * transport envelope). No writes, network, eval, include of untrusted paths.
 * Passing an associative PHP array instead of stdClass is deliberately rejected:
 * it irreversibly conflates JSON {} and [].
 */
function vefk_s6_validate_publication(stdClass $raw): void {
    // Preserve existing V2 acceptance behavior when no Vefk catalog was sent.
    if (!property_exists($raw,'vefkCatalog') || $raw->vefkCatalog === null) return;
    vefk_s6_require(($raw->schemaVersion ?? null) === 2, 'Publication şeması geçersiz');
    $meta=vefk_s6_object($raw->publication ?? null,'publication metadata');
    vefk_s6_require(vefk_s6_hash($meta->contentFingerprint ?? null),
      'Publication içerik fingerprint biçimi geçersiz');
    $meaning=new stdClass();
    foreach (['schemaVersion','journal','archive','assets','youtubeAnalysis','support'] as $field) {
        vefk_s6_require(property_exists($raw,$field),'Publication alanı eksik: '.$field);
        $meaning->{$field}=$raw->{$field};
    }
    if (property_exists($raw,'vefkCatalog') && $raw->vefkCatalog !== null) {
        $meaning->vefkCatalog=$raw->vefkCatalog;
    }
    vefk_s6_require(hash_equals($meta->contentFingerprint,vefk_s6_sha($meaning)),
      'Publication içerik fingerprint uyuşmuyor');
    if (!property_exists($meaning,'vefkCatalog')) return;
    $catalog=vefk_s6_object($raw->vefkCatalog,'vefkCatalog');
    vefk_s6_keys($catalog,['format','schemaVersion','binding','entries','fingerprint'],'catalog');
    vefk_s6_require(($catalog->format ?? null)==='birdesengor.vefk-catalog' &&
        in_array($catalog->schemaVersion ?? null,[1,2],true) && vefk_s6_hash($catalog->fingerprint ?? null),
        'Katalog sürüm/hash geçersiz');
    vefk_s6_require(strlen(vefk_s6_json($catalog))<=5*1024*1024,'Katalog boyutu aşıldı');
    $expectedBinding=json_decode('{"bindingVersion":2,"sceneId":"birdesengor-study-v2","surface":{"objectId":"vefk-stand","anchorId":"vefk-stand.ink-plane"},"pen":{"objectId":"quill","anchorId":"quill.tip"},"coordinateSpace":"svg-viewBox","fit":"contain"}',false,512,JSON_THROW_ON_ERROR);
    if ($catalog->schemaVersion===2) {
        $expectedBinding->bindingVersion=3;
        $expectedBinding->motion=(object)['strokeEasing'=>'v2'];
    }
    vefk_s6_require(vefk_s6_sha($catalog->binding ?? null)===vefk_s6_sha($expectedBinding),
        'Divit/parşömen sahne ankorları uyuşmuyor');
    $entries=vefk_s6_array($catalog->entries ?? null,'entries',32);
    $ids=[];$files=[];$previousOrder=null;$previousId=null;
    foreach ($entries as $entry) {
        $entry=vefk_s6_object($entry,'catalog.entry');
        vefk_s6_keys($entry,['id','revision','order','title','contentHash','url',
            'sha256','document'],'catalog.entry');
        $doc=vefk_s6_object($entry->document ?? null,'document');
        vefk_s6_require($catalog->schemaVersion===2 || ($doc->schemaVersion ?? null)===1,
            'Katalog v1 yalnız belge v1 kabul eder');
        vefk_s6_document($doc);
        vefk_s6_require(($entry->id ?? null)===$doc->id &&
           ($entry->revision ?? null)===$doc->revision &&
           ($entry->title ?? null)===$doc->title &&
           ($entry->contentHash ?? null)===$doc->contentHash &&
           vefk_s6_hash($entry->sha256 ?? null) &&
           is_int($entry->order ?? null) && $entry->order>=0 && $entry->order<=10000 &&
           !isset($ids[$doc->id]),'Katalog kimliği/revizyonu uyuşmuyor');
        $ids[$doc->id]=true;
        vefk_s6_require($previousOrder===null || $entry->order>$previousOrder ||
           ($entry->order===$previousOrder && strcmp($doc->id,$previousId)>0),
           'Katalog deterministik sırası bozuk');
        $previousOrder=$entry->order;$previousId=$doc->id;
        $body=vefk_s6_pretty(vefk_s6_canonical($doc))."\n";
        $fileSha=hash('sha256',$body);
        $url='vefk/documents/'.$doc->id.'-r'.$doc->revision.'-'.substr($fileSha,0,16).'.json';
        vefk_s6_require(hash_equals($entry->sha256,$fileSha) &&
          ($entry->url ?? null)===$url && !isset($files[$url]),
          'Belge bytes SHA256 veya katalog yolu uyuşmuyor');
        $files[$url]=true;
    }
    $logical=clone $catalog;unset($logical->fingerprint);
    vefk_s6_require(hash_equals($catalog->fingerprint,vefk_s6_sha($logical)),
       'Katalog fingerprint uyuşmuyor');
}
