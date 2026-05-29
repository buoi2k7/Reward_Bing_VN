// =============================================
// KEYWORDS DATA — v3.0 | 1200+ keywords
// Bổ sung: Trending 2025–2026, Dynamic theo ngày
// =============================================

// ─── DYNAMIC KEYWORDS (tự thay đổi theo ngày/tháng/mùa) ─────
self.getDynamicKeywords = function () {
  const now    = new Date();
  const day    = now.getDate();
  const month  = now.getMonth() + 1; // 1–12
  const year   = now.getFullYear();
  const weekday= now.getDay(); // 0=CN 1=T2...6=T7
  const hour   = now.getHours();

  const dayNames  = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];
  const monthNames= ['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6',
                     'tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'];

  const dynamic = [];

  // ── Theo giờ ──
  if (hour >= 5 && hour < 12) {
    dynamic.push('buổi sáng nên ăn gì', 'bài tập buổi sáng', 'thói quen buổi sáng tốt',
                 'uống gì buổi sáng tốt cho sức khỏe', 'yoga buổi sáng', 'thiền buổi sáng');
  } else if (hour >= 12 && hour < 18) {
    dynamic.push('ăn trưa gì ngon', 'quán ăn trưa gần đây', 'cơm trưa văn phòng',
                 'bài tập buổi chiều', 'snack ăn chiều', 'cà phê chiều');
  } else {
    dynamic.push('ăn tối gì ngon', 'phim xem buổi tối', 'nhạc nghe buổi tối',
                 'bài tập buổi tối', 'thư giãn sau giờ làm', 'đọc sách gì buổi tối');
  }

  // ── Theo thứ ──
  dynamic.push(`tin tức ${dayNames[weekday]} hôm nay`);
  dynamic.push(`lịch thi đấu bóng đá ${dayNames[weekday]}`);
  if (weekday === 0 || weekday === 6) {
    dynamic.push('chơi gì cuối tuần', 'đi đâu cuối tuần', 'quán ăn cuối tuần',
                 'cafe sáng cuối tuần', 'phim hay xem cuối tuần', 'du lịch 2 ngày 1 đêm');
  } else if (weekday === 1) {
    dynamic.push('motivation thứ hai', 'đầu tuần nên làm gì', 'lịch làm việc tuần này');
  } else if (weekday === 5) {
    dynamic.push('kế hoạch cuối tuần', 'đặt bàn nhà hàng thứ sáu', 'happy friday');
  }

  // ── Theo ngày trong tháng ──
  dynamic.push(`tin tức ngày ${day} tháng ${month}`);
  dynamic.push(`giá vàng ngày ${day}/${month}/${year}`);
  dynamic.push(`tỷ giá usd ngày ${day}/${month}`);
  dynamic.push(`chứng khoán ngày ${day} tháng ${month}`);

  // Đầu tháng
  if (day <= 5) {
    dynamic.push('lương tháng này', 'hóa đơn điện nước tháng này',
                 'kế hoạch tháng mới', 'budget tháng này');
  }
  // Cuối tháng
  if (day >= 25) {
    dynamic.push('tổng kết tháng này', 'thanh toán hóa đơn cuối tháng',
                 'lương sắp về rồi', 'tiết kiệm cuối tháng');
  }

  // ── Theo tháng / mùa ──
  dynamic.push(`thời tiết ${monthNames[month - 1]} ${year}`);
  dynamic.push(`sự kiện ${monthNames[month - 1]} ${year}`);
  dynamic.push(`xu hướng ${monthNames[month - 1]} ${year}`);

  // Tháng 1–2: Tết
  if (month === 1 || month === 2) {
    dynamic.push(
      'chuẩn bị tết', 'quà tết', 'bánh chưng bánh tét', 'hoa tết', 'cây quất tết',
      'lịch nghỉ tết', 'phong bì lì xì', 'trang trí nhà tết', 'đi chơi tết',
      'menu mâm cỗ tết', 'chúc tết', 'thiệp chúc tết', 'áo dài tết',
      'mua sắm tết', 'khuyến mãi tết', 'xông đất đầu năm', 'lì xì đầu năm',
      'tử vi năm mới', 'phong thủy đầu năm'
    );
  }

  // Tháng 3: Mùa xuân + 8/3
  if (month === 3) {
    dynamic.push(
      'quà 8 tháng 3', 'hoa 8/3', 'chúc mừng ngày quốc tế phụ nữ',
      'món ăn ngày xuân', 'lễ hội tháng 3', 'du lịch mùa xuân',
      'hoa anh đào nở', 'ngắm hoa tháng 3'
    );
  }

  // Tháng 4: 30/4–1/5
  if (month === 4) {
    dynamic.push(
      'lịch nghỉ lễ 30/4', 'tour du lịch 30/4', 'đặt khách sạn lễ 30/4',
      'địa điểm chơi 30 tháng 4', 'ăn gì ngày lễ'
    );
  }

  // Tháng 5: Nắng nóng
  if (month === 5) {
    dynamic.push(
      'đối phó nắng nóng', 'đồ uống giải nhiệt', 'kem chống nắng tốt nhất',
      'máy lạnh giá rẻ', 'quạt điều hòa', 'du lịch biển tháng 5'
    );
  }

  // Tháng 6–8: Hè
  if (month >= 6 && month <= 8) {
    dynamic.push(
      'hoạt động hè cho trẻ', 'camp hè', 'khóa học hè', 'du lịch hè',
      'biển đẹp mùa hè', 'đồ bơi đẹp', 'kem chống nắng mùa hè',
      'máy lạnh tiết kiệm điện', 'đá bào chè', 'nước giải khát mùa hè'
    );
  }

  // Tháng 8: Trung thu
  if (month === 8) {
    dynamic.push(
      'bánh trung thu', 'đèn lồng trung thu', 'quà trung thu', 'lễ trung thu',
      'múa lân trung thu', 'mâm cỗ trung thu', 'bánh trung thu handmade'
    );
  }

  // Tháng 9–11: Mùa thu
  if (month >= 9 && month <= 11) {
    dynamic.push(
      'du lịch mùa thu', 'ngắm lá vàng', 'áo khoác mùa thu', 'cà phê mùa thu',
      'hoa hướng dương', 'phong cảnh mùa thu', 'du lịch sapa mùa thu',
      'mùa lúa chín', 'mù cang chải mùa lúa'
    );
  }

  // Tháng 10: Halloween
  if (month === 10) {
    dynamic.push(
      'trang trí halloween', 'bánh halloween', 'hóa trang halloween',
      'tiệc halloween', 'halloween 2026'
    );
  }

  // Tháng 11–12: Mùa đông + Giáng sinh
  if (month === 11 || month === 12) {
    dynamic.push(
      'áo ấm mùa đông', 'trang trí noel', 'quà giáng sinh', 'cây thông noel',
      'tiệc cuối năm', 'tổng kết cuối năm', 'du lịch đông bắc mùa đông',
      'lẩu mùa đông', 'đồ ăn mùa lạnh', 'countdown tết dương lịch'
    );
  }

  // Năm chẵn: World Cup
  if (year === 2026) {
    dynamic.push(
      `world cup 2026 tháng ${month}`, 'lịch thi đấu world cup 2026',
      'kết quả world cup 2026', 'bảng xếp hạng world cup 2026',
      'đội tuyển việt nam world cup', 'world cup mỹ canada mexico'
    );
  }

  return dynamic;
};

// ─── STATIC KEYWORD LIST ─────────────────────────────────────
self.KEYWORD_LIST = [

  // ══════════════════════════════════════════
  // TIN TỨC & THỜI SỰ (50)
  // ══════════════════════════════════════════
  'tin tức hôm nay', 'tin tức 24h', 'thời sự việt nam', 'tin thế giới', 'tin kinh tế',
  'tin pháp luật', 'tin giáo dục', 'tin y tế', 'tin xã hội', 'tin văn hóa',
  'tin thể thao', 'tin nóng hôm nay', 'báo mới nhất', 'tin trong nước',
  'tin nước ngoài', 'tin chính trị', 'tin an ninh', 'tin quân sự',
  'tin tai nạn giao thông', 'tin môi trường', 'tin biến đổi khí hậu',
  'tin công nghệ 2026', 'dự báo 2026', 'xu hướng 2027',
  'tin tức nổi bật tuần này', 'sự kiện quốc tế hôm nay',
  'thời sự quốc tế', 'tổng thống mỹ 2025', 'bầu cử mỹ 2026',
  'cuộc chiến thương mại mỹ trung', 'căng thẳng địa chính trị',
  'tin xung đột ukraine', 'tin trung đông', 'hội nghị g20',
  'liên hợp quốc họp', 'nato mở rộng', 'asean summit',
  'tin đông nam á', 'tin trung quốc mới nhất', 'tin nhật bản',
  'tin hàn quốc', 'tin mỹ hôm nay', 'tin châu âu',
  'tin úc', 'tin canada', 'donald trump tin tức',
  'elon musk tin tức', 'tỷ phú thế giới', 'người giàu nhất thế giới',
  'giá dầu thế giới hôm nay', 'kinh tế toàn cầu 2026',

  // ══════════════════════════════════════════
  // THỜI TIẾT (25)
  // ══════════════════════════════════════════
  'thời tiết hà nội', 'thời tiết sài gòn', 'thời tiết đà nẵng', 'thời tiết hôm nay',
  'dự báo thời tiết', 'thời tiết tuần này', 'thời tiết việt nam', 'thời tiết miền bắc',
  'thời tiết miền nam', 'thời tiết miền trung', 'thời tiết cần thơ', 'thời tiết huế',
  'thời tiết nha trang', 'thời tiết vũng tàu', 'thời tiết hải phòng',
  'thời tiết 7 ngày', 'thời tiết tháng này', 'áp thấp nhiệt đới', 'bão việt nam',
  'cảnh báo lũ lụt', 'dự báo mưa', 'nắng nóng hôm nay', 'rét đậm rét hại',
  'el nino 2026', 'la nina 2026',

  // ══════════════════════════════════════════
  // AI & CÔNG NGHỆ HOT 2025–2026 (70)
  // ══════════════════════════════════════════
  'chatgpt', 'chatgpt 4o', 'chatgpt plus', 'chatgpt tiếng việt', 'cách dùng chatgpt',
  'claude ai', 'claude anthropic', 'gemini google', 'gemini 2.0', 'google gemini ultra',
  'grok ai', 'grok elon musk', 'deepseek ai', 'deepseek r2', 'deepseek việt nam',
  'microsoft copilot', 'github copilot', 'copilot trong word excel',
  'sora openai', 'ai video generation', 'runway ai video', 'kling ai',
  'midjourney', 'stable diffusion', 'dall-e 3', 'ai tạo ảnh miễn phí',
  'ai tạo video', 'ai đọc tài liệu', 'ai tóm tắt văn bản', 'ai viết content',
  'ai viết code', 'cursor ai', 'windsurf ai', 'vs code copilot',
  'llama meta ai', 'mistral ai', 'phi microsoft', 'qwen alibaba',
  'ai agent 2026', 'autonomous ai', 'agentic ai', 'ai làm việc thay người',
  'artificial general intelligence', 'agi 2026',
  'vấn đề ai ethics', 'ai và việc làm', 'ai thay thế con người',
  'samsung ai', 'apple intelligence', 'ios ai', 'android ai',
  'chip ai snapdragon', 'chip ai apple m4', 'nvidia blackwell',
  'ai trong y tế', 'ai trong giáo dục', 'ai trong tài chính',
  'ai nhận diện khuôn mặt', 'ai dịch thuật', 'google translate 2026',
  'deepl dịch', 'ai đọc sách thay bạn',
  'notion ai', 'perplexity ai', 'you.com', 'phind ai code',
  'replit ai', 'bolt.new', 'v0 dev', 'lovable ai',
  'công nghệ mới 2026', 'công nghệ 2027', 'tin công nghệ',

  // ══════════════════════════════════════════
  // ĐIỆN THOẠI & GADGET 2025–2026 (50)
  // ══════════════════════════════════════════
  'iphone 17', 'iphone 17 pro', 'iphone 17 air', 'iphone 16 review',
  'samsung galaxy s25', 'samsung galaxy s25 ultra', 'samsung s25 plus',
  'samsung galaxy z fold 7', 'samsung z flip 7',
  'xiaomi 15', 'xiaomi 15 ultra', 'xiaomi 15 pro',
  'oppo find x8 pro', 'oppo reno 13', 'vivo x200 pro',
  'pixel 9 pro', 'google pixel 9', 'oneplus 13',
  'realme gt 7 pro', 'asus zenfone 12',
  'điện thoại tầm trung 2026', 'điện thoại dưới 5 triệu',
  'điện thoại dưới 10 triệu', 'điện thoại chụp ảnh đẹp',
  'macbook air m4', 'macbook pro m4', 'macbook pro m4 max',
  'ipad pro m4', 'ipad air m3', 'ipad mini 7',
  'apple watch ultra 3', 'apple watch series 11',
  'airpods 4', 'airpods pro 3', 'galaxy buds 3 pro',
  'sony wh-1000xm6', 'jabra elite 10',
  'laptop gaming 2026', 'laptop asus rog', 'laptop msi',
  'laptop lenovo legion', 'laptop dell xps', 'laptop hp spectre',
  'màn hình 4k gaming', 'màn hình oled laptop',
  'gpu rtx 5090', 'rtx 5080', 'amd rx 9070 xt',
  'ssd 4tb', 'ram ddr5', 'cpu intel arrow lake',
  'vr headset apple vision pro', 'meta quest 4',

  // ══════════════════════════════════════════
  // GAME HOT 2025–2026 (50)
  // ══════════════════════════════════════════
  'liên quân mobile 2026', 'liên quân rank', 'liên quân mùa 2026',
  'liên minh huyền thoại', 'lol wild rift', 'valorant', 'valorant việt nam',
  'free fire max', 'free fire ob50', 'free fire tournament',
  'pubg mobile 2026', 'pubg new update', 'pubg global',
  'mobile legends bang bang', 'mlbb tournament', 'rrq hoshi',
  'honor of kings', 'hok tournament 2026',
  'genshin impact 5.0', 'genshin impact guide', 'honkai star rail',
  'zenless zone zero', 'wuthering waves',
  'call of duty mobile', 'warzone 2026',
  'minecraft bedrock', 'minecraft java', 'minecraft 1.22',
  'roblox 2026', 'roblox game hay',
  'fortnite chapter 6', 'fortnite mới nhất',
  'baldurs gate 3', 'elden ring dlc', 'black myth wukong',
  'gta 6', 'gta 6 release date', 'gta 6 việt nam',
  'grand theft auto vi', 'cyberpunk 2077 dlc',
  'steam giảm giá', 'epic games free', 'ps5 game hay',
  'xbox series x game', 'nintendo switch 2',
  'esports việt nam 2026', 'vcs mùa xuân', 'vcs mùa hè',
  'sgc mobile', 'team flash', 'saigon phantom',
  'msi 2026', 'worlds 2026 lol',

  // ══════════════════════════════════════════
  // K-POP / K-DRAMA / HALLYU (50)
  // ══════════════════════════════════════════
  'bts tin tức 2026', 'bts comeback', 'bts world tour',
  'blackpink 2026', 'blackpink tour việt nam',
  'aespa comeback', 'aespa mv mới', 'newjeans 2026',
  'ive comeback', 'le sserafim', 'stray kids world tour',
  'nct 127', 'nct dream', 'seventeen', 'enhypen',
  'txt tomorrow by together', 'ateez', 'the boyz',
  'kpop idol mới debut', 'kpop 4th gen', 'kpop 5th gen',
  'phim hàn hay 2026', 'phim hàn romantic', 'phim hàn hành động',
  'phim hàn netflix 2026', 'kdrama hay nhất 2026',
  'squid game season 3', 'moving season 2', 'mask girl 2',
  'my demon', 'doctor slump 2', 'queen of tears 2',
  'phim hàn xem gì', 'top phim hàn 2026',
  'lee min ho phim mới', 'song joong ki phim mới',
  'park seo joon', 'hyun bin', 'son ye jin', 'jun ji hyun',
  'iu phim mới', 'kim tae ri', 'suzy bae',
  'hallyu việt nam', 'fan kpop việt nam', 'kpop chart việt',
  'melon chart', 'gaon chart', 'hanteo chart',
  'mnet mama awards 2026', 'golden disc awards',

  // ══════════════════════════════════════════
  // VPOP & NGHỆ SĨ VIỆT HOT (50)
  // ══════════════════════════════════════════
  'sơn tùng mtp mới nhất', 'sơn tùng mv 2026', 'sơn tùng concert',
  'đen vâu album mới', 'đen vâu 2026', 'đen vâu bài mới',
  'hoàng thùy linh', 'hoàng thùy linh mv', 'hoàng thùy linh 2026',
  'hieuthuhai', 'hieuthuhai rap', 'hieuthuhai tour',
  'binz rap', 'binz album', 'rhymastic', 'wxrdie',
  'tlinh', 'tlinh mv mới', 'obito rapper',
  'wren evans', 'wren evans bài mới', 'wren evans vpop',
  'amee ca sĩ', 'amee 2026', 'karik rapper',
  'bray rapper', 'hurrykng', 'low g',
  'cát phượng', 'trấn thành', 'trường giang',
  'việt hương', 'hoài linh', 'hứa kim tuyền',
  'jack j97', 'jack ca sĩ 2026', 'erik vpop',
  'thu minh', 'mỹ tâm', 'hà anh tuấn',
  'quang vinh parade', 'noo phước thịnh',
  'rap việt season mới', 'anh trai say hi', 'anh trai vượt ngàn chông gai',
  'chị đẹp đạp gió 2026', 'cô gái nhà người ta show',
  'rising star việt nam', 'the voice 2026',
  'nhạc indie việt', 'vpop hay nhất 2026', 'nhạc việt trending',

  // ══════════════════════════════════════════
  // PHIM & STREAMING (45)
  // ══════════════════════════════════════════
  'phim hay 2026', 'phim netflix hay', 'phim netflix việt nam',
  'phim disney plus', 'phim apple tv plus', 'phim hbo max',
  'phim hành động 2026', 'phim kinh dị 2026', 'phim viễn tưởng 2026',
  'phim hoạt hình pixar 2026', 'phim marvel 2026', 'marvel phase 6',
  'avengers secret wars', 'phim dc 2026', 'superman 2025',
  'the batman 2', 'dune 3', 'star wars 2026',
  'mission impossible dead reckoning', 'fast furious 11',
  'phim việt nam hay 2026', 'phim rạp việt nam',
  'phim chiếu rạp tháng này', 'cinestar', 'cgv', 'lotte cinema',
  'review phim mới nhất', 'spoiler phim', 'after credits',
  'phim trung quốc hay 2026', 'phim cổ trang trung quốc',
  'phim nhật hay 2026', 'phim anime 2026',
  'one piece 2026', 'demon slayer season mới', 'attack on titan',
  'naruto boruto 2', 'dragon ball daima',
  'anime hay nhất 2026', 'anime mùa xuân 2026', 'anime mùa hè 2026',
  'youtube việt nam hot', 'youtube shorts viral',
  'tiktok phim review', 'phim review tóm tắt',

  // ══════════════════════════════════════════
  // TIKTOK & MẠNG XÃ HỘI VIRAL (40)
  // ══════════════════════════════════════════
  'tiktok trending', 'tiktok viral việt nam', 'tiktok dance trend',
  'trend tiktok 2026', 'challenge tiktok mới',
  'tiktok review đồ ăn', 'tiktok thử thách',
  'instagram reels việt', 'facebook watch viral',
  'youtube shorts trending', 'youtube việt nam',
  'influencer việt nam', 'kol việt nam hot',
  'streamer việt nam', 'garena streamer', 'youtube gaming vn',
  'pewpew streamer', 'xemesis', 'misthy streamer',
  'cris devil gamer', 'faptv', 'đinh tiến đạt',
  'giang ơi', 'khoai lang thang', 'khoa pug',
  'quỳnh anh shyn', 'saliha beauty', 'ninh dương lan ngọc',
  'linh ngọc đàm', 'vũ khắc tiệp',
  'trend ăn uống mới', 'food trend 2026',
  'trend thời trang tiktok', 'thrift shop trend',
  'y2k fashion trend', 'indie aesthetic',
  'cottagecore aesthetic', 'dark academia style',
  'liveness stream bán hàng', 'livestream shopee',
  'livestream tiktok shop', 'affiliate tiktok',

  // ══════════════════════════════════════════
  // THỂ THAO HOT 2025–2026 (60)
  // ══════════════════════════════════════════
  'bóng đá việt nam', 'lịch thi đấu bóng đá', 'kết quả bóng đá',
  'premier league 2025-26', 'bxh premier league', 'vòng này premier league',
  'la liga 2025-26', 'barca vs real madrid', 'el clasico 2026',
  'serie a 2025-26', 'bundesliga 2025-26', 'ligue 1 2025-26',
  'champions league 2025-26', 'europa league', 'conference league',
  'euro 2028 vòng loại', 'world cup 2026', 'world cup bảng đấu',
  'v-league 2026', 'lịch v-league', 'câu lạc bộ hà nội fc',
  'hoàng anh gia lai', 'câu lạc bộ tp hcm', 'thanh hóa fc',
  'đội tuyển việt nam', 'đội tuyển u23 việt nam', 'đội tuyển nữ việt nam',
  'hlv kim sang sik', 'sea games 34', 'asiad 2026',
  'messi inter miami', 'ronaldo al nassr 2026',
  'haaland man city', 'mbappé real madrid',
  'transfer window 2026', 'chuyển nhượng bóng đá',
  'nba 2025-26', 'nba playoffs 2026', 'nba finals 2026',
  'lebron james', 'stephen curry', 'nikola jokic',
  'wimbledon 2026', 'us open 2026', 'roland garros 2026', 'australian open 2026',
  'djokovic 2026', 'alcaraz tennis', 'sinner tennis', 'swiatek tennis',
  'formula 1 2026', 'f1 lịch đua', 'verstappen f1',
  'boxing ufc 2026', 'ufc kết quả', 'mma việt nam',
  'golf pga tour', 'tiger woods', 'swimming world 2026',
  'olympic 2028 los angeles', 'olympic 2028 chuẩn bị',

  // ══════════════════════════════════════════
  // DU LỊCH (40)
  // ══════════════════════════════════════════
  'du lịch đà nẵng', 'du lịch phú quốc', 'du lịch nha trang', 'du lịch đà lạt',
  'du lịch sapa', 'du lịch hạ long', 'du lịch hội an',
  'du lịch miền tây sông nước', 'du lịch côn đảo', 'du lịch cát bà',
  'du lịch mù cang chải', 'du lịch cao bằng', 'du lịch ninh bình',
  'du lịch quảng bình phong nha', 'du lịch tây bắc',
  'du lịch nhật bản', 'du lịch hàn quốc', 'du lịch thái lan',
  'du lịch singapore', 'du lịch mã lai', 'du lịch indonesia bali',
  'du lịch đài loan', 'du lịch hongkong', 'du lịch trung quốc',
  'du lịch châu âu tự túc', 'du lịch pháp paris', 'du lịch ý rome',
  'du lịch mỹ new york', 'du lịch úc', 'du lịch canada',
  'kinh nghiệm xin visa', 'visa nhật bản', 'visa hàn quốc',
  'vé máy bay giá rẻ', 'vé máy bay bamboo', 'vé máy bay vietjet',
  'vé máy bay vietnam airlines', 'tour giá rẻ',
  'homestay đà lạt', 'airbnb việt nam',

  // ══════════════════════════════════════════
  // ẨM THỰC TRENDING (45)
  // ══════════════════════════════════════════
  'món ăn ngon', 'công thức nấu ăn', 'món ngon hà nội', 'món ngon sài gòn',
  'cách làm phở', 'cách làm bún bò huế', 'cách làm bánh cuốn',
  'cách làm bánh mì', 'cách làm gỏi cuốn', 'cách làm chả giò',
  'street food việt nam', 'quán ăn ngon hà nội', 'quán ăn ngon sài gòn',
  'buffet lẩu nướng', 'buffet hải sản', 'nhà hàng view đẹp',
  'cà phê rang xay ngon', 'quán cà phê đẹp hà nội', 'quán cà phê view sài gòn',
  'cà phê trứng hà nội', 'egg coffee', 'bạc xỉu', 'cà phê đá',
  'trà sữa ngon', 'cách làm trà sữa tại nhà', 'pha chế đồ uống',
  'trend đồ ăn 2026', 'viral food tiktok',
  'cách làm bánh flan', 'cách làm sữa chua', 'cách làm chè',
  'cách làm đồ uống bán', 'kinh doanh đồ ăn vặt',
  'món ăn chay ngon', 'ăn chay có lợi', 'thuần chay vegan',
  'keto diet việt nam', 'món ăn keto', 'low carb việt nam',
  'món ăn hàn quốc tại nhà', 'cách làm kimchi', 'cách làm tteok',
  'món ăn nhật tại nhà', 'cách làm sushi', 'cách làm ramen',
  'food blogger ăn ngon', 'review quán ăn mới',

  // ══════════════════════════════════════════
  // SỨC KHỎE & LÀM ĐẸP HOT 2025–2026 (50)
  // ══════════════════════════════════════════
  'giảm cân 2026', 'giảm cân nhanh', 'giảm mỡ bụng hiệu quả',
  'ozempic giảm cân', 'thuốc giảm cân wegovy', 'glp-1 là gì',
  'cách giảm cân không nhịn ăn', 'thực đơn giảm cân 1 tuần',
  'tập gym tại nhà', 'bài tập 15 phút mỗi ngày', 'pilates tại nhà',
  'yoga giảm stress', 'thiền định 10 phút', 'mindfulness',
  'chạy bộ buổi sáng', 'calo khi chạy bộ', 'máy chạy bộ gia đình',
  'chăm sóc da mặt tại nhà', 'skincare routine 2026',
  'serum vitamin c tốt', 'retinol là gì', 'niacinamide tác dụng',
  'kem dưỡng ẩm tốt nhất', 'kem chống nắng spf50',
  'tẩy trang đúng cách', 'double cleansing',
  'trị mụn tại nhà', 'mụn đầu đen', 'mụn cám',
  'làn da sáng khỏe', 'glass skin routine',
  'tóc đẹp 2026', 'tóc layer ngắn', 'tóc uốn xoăn nhẹ',
  'nhuộm tóc màu gì đẹp', 'tóc nâu caramel', 'tóc ash blonde',
  'nail art 2026', 'kiểu nail đẹp', 'gel nail',
  'chăm sóc sức khỏe tâm thần', 'anxiety là gì', 'depression',
  'burnout là gì', 'work life balance', 'giảm stress công việc',
  'ngủ đủ giấc', 'mất ngủ phải làm gì', 'melatonin',
  'vitamin d thiếu hụt', 'uống collagen', 'thực phẩm bổ sung',

  // ══════════════════════════════════════════
  // TÀI CHÍNH & CRYPTO HOT (55)
  // ══════════════════════════════════════════
  'giá vàng hôm nay', 'vàng sjc', 'vàng nhẫn', 'giá vàng 9999',
  'tỷ giá đô la hôm nay', 'tỷ giá usd vnd', 'tỷ giá euro',
  'chứng khoán hôm nay', 'vnindex hôm nay', 'cổ phiếu khuyến nghị',
  'cổ phiếu tăng mạnh', 'thị trường chứng khoán',
  'bitcoin giá hôm nay', 'bitcoin btc', 'ethereum eth',
  'crypto 2026', 'altcoin hot 2026', 'solana sol',
  'bnb binance', 'xrp ripple', 'dogecoin', 'shiba inu',
  'bitcoin halving 2024 ảnh hưởng', 'bitcoin 100k',
  'crypto việt nam', 'pháp lý crypto việt nam',
  'defi là gì', 'nft 2026', 'web3 việt nam',
  'đầu tư bất động sản 2026', 'giá nhà hà nội 2026',
  'giá nhà sài gòn 2026', 'đất nền sốt', 'bds sốt đất',
  'lãi suất ngân hàng 2026', 'gửi tiết kiệm lãi cao',
  'vay mua nhà lãi suất thấp', 'vay ngân hàng 2026',
  'quản lý tài chính cá nhân', 'quy tắc 50/30/20',
  'quỹ dự phòng', 'đầu tư cổ phiếu cơ bản',
  'etf là gì', 'quỹ mở', 'vinacapital', 'dragon capital',
  'tiết kiệm tiền mỗi tháng', 'passive income 2026',
  'dropshipping 2026', 'kiếm tiền online 2026',
  'freelance việt nam', 'upwork việt nam',
  'kinh doanh shopee', 'tiktok shop bán hàng',

  // ══════════════════════════════════════════
  // HỌC TẬP & LẬP TRÌNH (55)
  // ══════════════════════════════════════════
  'học tiếng anh', 'học ielts', 'ielts 7.0', 'học toeic 900',
  'học tiếng hàn', 'học tiếng nhật', 'học tiếng trung', 'hsk',
  'duolingo', 'elsa speak', 'english với người bản ngữ',
  'lập trình python 2026', 'học python cơ bản', 'python cho người mới',
  'học javascript', 'typescript cơ bản', 'react 2026', 'nextjs 14',
  'nodejs express', 'fastapi python', 'django',
  'học flutter', 'react native 2026', 'kotlin android',
  'swift ios', 'lập trình game unity',
  'machine learning cơ bản', 'deep learning', 'prompt engineering',
  'học ai 2026', 'học data science', 'tableau', 'power bi',
  'sql cơ bản', 'mysql', 'postgresql', 'mongodb',
  'docker kubernetes', 'devops roadmap', 'aws azure gcp',
  'học blockchain solidity', 'smart contract',
  'cybersecurity học', 'ethical hacking',
  'figma ui ux', 'học thiết kế đồ họa',
  'viết cv xin việc 2026', 'mẫu cv đẹp', 'linkedin tối ưu',
  'phỏng vấn it', 'leetcode', 'hackerrank',
  'học online coursera 2026', 'udemy khóa học hay',
  'youtube học lập trình miễn phí',
  'thi đại học 2026', 'ôn thi thpt 2026', 'đề thi thử 2026',
  'học bổng du học', 'du học nhật bản học bổng',

  // ══════════════════════════════════════════
  // XE CỘ 2025–2026 (45)
  // ══════════════════════════════════════════
  'xe điện vinfast 2026', 'vinfast vf3', 'vinfast vf5',
  'vinfast vf6', 'vinfast vf7', 'vinfast vf8', 'vinfast vf9',
  'xe điện trung quốc byd', 'byd atto 3', 'tesla model y',
  'xe điện giá rẻ 2026', 'sạc xe điện', 'trạm sạc việt nam',
  'honda vision 2026', 'honda air blade 2026', 'honda wave alpha',
  'yamaha exciter 155', 'yamaha grande', 'yamaha nmax',
  'xe máy tay ga 2026', 'xe máy côn tay', 'xe máy mới ra',
  'ô tô giá rẻ dưới 500 triệu', 'ô tô gầm cao', 'ô tô 7 chỗ',
  'toyota vios 2026', 'toyota camry 2026', 'toyota fortuner',
  'hyundai accent', 'hyundai tucson', 'kia seltos', 'kia sportage',
  'mazda cx-5 2026', 'mitsubishi xpander', 'suzuki ertiga',
  'mua ô tô trả góp', 'giá xe ô tô 2026', 'ô tô cũ giá tốt',
  'review ô tô', 'oto.com.vn', 'bonbanh',
  'bảo hiểm xe ô tô 2026', 'phí đăng kiểm xe',
  'xăng giá bao nhiêu hôm nay', 'giá xăng hôm nay',

  // ══════════════════════════════════════════
  // MUA SẮM & THỜI TRANG 2026 (45)
  // ══════════════════════════════════════════
  'shopee khuyến mãi', 'shopee 6.6', 'shopee 9.9', 'shopee 11.11', 'shopee 12.12',
  'lazada flash sale', 'tiki deal', 'sendo khuyến mãi',
  'thời trang nam 2026', 'thời trang nữ 2026',
  'xu hướng thời trang xuân hè 2026', 'xu hướng thu đông 2026',
  'áo sơ mi nam đẹp', 'quần tây nam', 'giày oxford',
  'túi xách nữ hot', 'túi tote', 'mini bag',
  'giày thể thao adidas', 'giày nike', 'giày new balance',
  'sneaker hot 2026', 'giày air force 1', 'giày yeezy',
  'streetwear việt nam', 'local brand việt nam hot',
  'mỹ phẩm hàn quốc hot', 'mỹ phẩm nhật bản',
  'son thỏi hot 2026', 'phấn phủ', 'cushion đẹp',
  'kem dưỡng thể', 'nước hoa nữ hot 2026', 'nước hoa nam',
  'đồng hồ nam giá tầm trung', 'casio mtp', 'seiko',
  'kính mắt cận đẹp', 'kính mát uv400',
  'balo đi học đẹp', 'balo laptop chống nước',
  'đồ gym nữ đẹp', 'legging thể thao',

  // ══════════════════════════════════════════
  // BẤT ĐỘNG SẢN (25)
  // ══════════════════════════════════════════
  'nhà đất bán', 'nhà đất cho thuê', 'căn hộ chung cư',
  'đất nền dự án', 'bất động sản hà nội', 'bất động sản sài gòn',
  'bất động sản đà nẵng', 'bất động sản đà lạt',
  'vinhomes ocean park', 'vinhomes smart city', 'masterise',
  'cho thuê căn hộ mini', 'phòng trọ sinh viên',
  'căn hộ 1 phòng ngủ', 'studio apartment',
  'luật nhà ở 2024', 'luật đất đai mới',
  'giá nhà hà nội bao nhiêu', 'mua nhà hà nội dưới 2 tỷ',
  'mua nhà sài gòn', 'nhà chung cư an toàn',
  'sổ đỏ sổ hồng', 'thủ tục mua bán nhà',
  'đầu tư căn hộ cho thuê', 'lợi nhuận bất động sản',

  // ══════════════════════════════════════════
  // GIA ĐÌNH & TRẺ EM (30)
  // ══════════════════════════════════════════
  'chăm sóc trẻ em', 'nuôi dạy con', 'đồ chơi trẻ em',
  'sữa bột cho bé 0-6 tháng', 'sữa bột tốt nhất',
  'xe đẩy em bé', 'nôi cũi cho bé', 'quần áo trẻ sơ sinh',
  'giáo dục sớm', 'montessori', 'stem cho trẻ',
  'dạy con kỹ năng sống', 'sách thiếu nhi', 'phim hoạt hình',
  'khu vui chơi trẻ em', 'thế giới kỳ diệu', 'vui chơi giải trí',
  'tâm lý trẻ em', 'trẻ biếng ăn', 'trẻ chậm nói',
  'vaccine cho trẻ 2026', 'lịch tiêm vaccine', 'bệnh thường gặp ở trẻ',
  'chăm sóc thai kỳ', 'mang thai 3 tháng đầu',
  'chăm sóc sau sinh', 'trầm cảm sau sinh',
  'nuôi con bằng sữa mẹ', 'máy hút sữa',
  'trường mầm non tốt', 'giáo viên mầm non',

  // ══════════════════════════════════════════
  // SỰ KIỆN & LỄ HỘI (25)
  // ══════════════════════════════════════════
  'tết nguyên đán 2027', 'lịch nghỉ tết 2027', 'lễ hội tết',
  'lễ valentine 2026', 'quà 8 tháng 3',
  'lễ giỗ tổ hùng vương', 'lễ 30/4 1/5',
  'lễ trung thu 2026', 'lễ halloween 2026',
  'giáng sinh 2026', 'noel 2026', 'đêm giáng sinh',
  'năm mới 2027', 'countdown 2027', 'pháo hoa tết 2027',
  'festival âm nhạc việt nam', 'concert 2026 việt nam',
  'lễ hội bia hà nội', 'carnaval đà nẵng', 'lễ hội hoa đà lạt',
  'marathon hanoi 2026', 'ironman vietnam', 'lễ hội sông nước',
  'hội sách việt nam', 'triển lãm quốc tế',

  // ══════════════════════════════════════════
  // PHONG THỦY & TÂM LINH (20)
  // ══════════════════════════════════════════
  'phong thủy nhà ở 2026', 'phong thủy màu sắc', 'phong thủy bàn làm việc',
  'xem bói online', 'tử vi 2026', 'tử vi hàng ngày',
  'cung hoàng đạo 2026', 'song tử', 'bạch dương', 'bảo bình',
  'xem tuổi xây nhà 2026', 'tuổi nào tốt năm 2026',
  'cây phong thủy mang lại tài lộc', 'cây kim tiền', 'cây lucky bamboo',
  'đá phong thủy tốt', 'vòng đá tự nhiên', 'tượng phong thủy',
  'lịch vạn niên 2026', 'ngày tốt tháng này', 'hướng xuất hành',

  // ══════════════════════════════════════════
  // NGÂN HÀNG & FINTECH (25)
  // ══════════════════════════════════════════
  'vietcombank', 'agribank', 'bidv', 'techcombank', 'vietinbank',
  'mb bank', 'vpbank', 'tpbank', 'acb', 'sacombank',
  'momo', 'zalopay', 'vnpay', 'shopeepay',
  'ví điện tử nào tốt', 'chuyển tiền momo miễn phí',
  'thẻ tín dụng không phí', 'thẻ visa debit',
  'vay tiền online nhanh', 'vay tiền không thế chấp',
  'lãi suất vay mua nhà', 'gói vay ưu đãi',
  'internet banking', 'mobile banking bảo mật',
  'mở tài khoản online', 'thẻ ghi nợ nội địa',

  // ══════════════════════════════════════════
  // KHOA HỌC & VŨ TRỤ (30)
  // ══════════════════════════════════════════
  'nasa 2026', 'spacex 2026', 'spacex starship', 'elon musk spacex',
  'artemis mặt trăng', 'con người lên mặt trăng',
  'sao hỏa 2026', 'nhiệm vụ sao hỏa', 'colonize mars',
  'kính thiên văn jwst khám phá', 'hành tinh mới', 'exoplanet',
  'nhật thực 2026', 'nguyệt thực 2026', 'sao chổi 2026',
  'bão mặt trời', 'cực quang bắc bộ',
  'khám phá đại dương', 'sinh vật biển sâu mới',
  'khủng long mới tìm thấy', 'hóa thạch mới nhất',
  'lượng tử computing', 'máy tính lượng tử google',
  'chip sinh học', 'neuralink 2026',
  'crispr gene editing', 'công nghệ sinh học',
  'năng lượng mặt trời giá rẻ', 'pin năng lượng mới',
  'hydrogen năng lượng', 'điện gió ngoài khơi',

  // ══════════════════════════════════════════
  // THÚ CƯNG (20)
  // ══════════════════════════════════════════
  'chó corgi', 'chó poodle', 'chó shiba inu', 'chó alaska',
  'mèo anh lông ngắn', 'mèo munchkin', 'mèo maine coon',
  'thức ăn chó tốt nhất', 'thức ăn mèo hạt',
  'chăm sóc chó con mới đẻ', 'vaccine chó 2026',
  'huấn luyện chó obedience', 'dạy chó ngồi',
  'phòng khám thú y gần đây', 'bệnh thường gặp ở chó',
  'cá cảnh bể nước ngọt', 'cá koi', 'thức ăn cá',
  'hamster đáng yêu', 'nuôi hamster mới bắt đầu',
  'cộng đồng pet lover việt nam',

  // ══════════════════════════════════════════
  // MẸO VẶT & ĐỜI SỐNG (30)
  // ══════════════════════════════════════════
  'mẹo vặt cuộc sống', 'mẹo nội trợ hay', 'mẹo dọn nhà nhanh',
  'mẹo tiết kiệm điện', 'mẹo tiết kiệm tiền',
  'mẹo windows 11', 'mẹo dùng iphone', 'phím tắt excel',
  'mẹo google search', 'ẩn danh trên mạng',
  'kiến thức bổ ích', 'hack não học nhanh hơn',
  'phương pháp pomodoro', 'second brain notion',
  'lối sống tối giản minimalism', 'sống xanh 2026',
  'zero waste lifestyle', 'tái chế sáng tạo',
  'DIY đồ dùng nhà', 'handmade quà tặng',
  'học vẽ online miễn phí', 'học guitar bài đơn giản',
  'học piano tự học', 'rubik giải nhanh',
  'sách hay nên đọc 2026', 'sách tự phát triển bản thân',
  'atomic habits', 'ikigai cuốn sách', 'the alchemist',
  'tư duy phản biện', 'critical thinking',

  // ══════════════════════════════════════════
  // TIẾNG ANH THÔNG DỤNG (30)
  // ══════════════════════════════════════════
  'weather today', 'news today', 'top movies 2026',
  'best restaurants near me', 'healthy recipes 2026',
  'workout at home', 'morning routine tips',
  'productivity tips 2026', 'time management',
  'investment tips 2026', 'stock market today',
  'bitcoin price today', 'ethereum today',
  'artificial intelligence news', 'chatgpt latest update',
  'how to learn fast', 'study tips for students',
  'best books to read 2026', 'self improvement habits',
  'travel destinations 2026', 'cheap flights',
  'best laptops 2026', 'best smartphones 2026',
  'fashion trends 2026', 'skincare routine',
  'mental health tips', 'anxiety management',
  'world cup 2026 schedule', 'premier league results',
  'nba scores today', 'formula 1 results',
];

// ─── COMBINED GETTER (dùng cái này trong background.js) ──────
self.getAllKeywords = function () {
  const dynamic  = self.getDynamicKeywords();
  const combined = [...self.KEYWORD_LIST, ...dynamic];
  // Shuffle để không lặp pattern
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined;
};
