# Channel Foundry kanonik Efekt Motoru

Kanonik model ve çalışma motoru: src/model, src/registry, src/runtime. Fotoğraf v1 test araçları src/editor altında kalır; BirDeSenGör masaüstü editörü artık bu paketin parçası değildir.
Fotoğraf v1 ve nesne sahnesi v2 ortak motoru kullanır. BirDeSenGör web, Vite alias'ıyla doğrudan runtime'a bağlanır. Studio Sahne Atölyesi, apps/studio/src/scene-workspace içindeki doğrudan React çalışma yüzeyinde düzenlenir; iframe kullanılmaz.

Yardımcı Asistan kendi site efekt ve yayın yönetimini koruyacak; geçiş sonrası bu paketten SHA-256 doğrulamalı sürümlü snapshot alacak. Eski bağımsız EfektAtolyesi checkout artık gerekli değildir; bütün çalışma kaynakları Channel Foundry içindedir.

Test: npm run verify:effect-engine; Studio: npm run verify:scene-workshop.
