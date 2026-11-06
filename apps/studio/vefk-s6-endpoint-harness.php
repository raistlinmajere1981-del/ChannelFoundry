<?php
declare(strict_types=1);
/** CLI-only test transport. Never installed under public/. The production
 * handler, authentication, parser, validator, writer and cleanup run unchanged.
 * Only php://input is supplied from the serialized request body instead of SAPI.
 */
if (PHP_SAPI !== 'cli') exit(1);
$case = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
final class S6TestInput {
    public $context;
    public static string $body;
    public static int $opens = 0;
    private int $offset = 0;
    public function stream_open(string $path, string $mode, int $options, ?string &$openedPath): bool {
        if ($path !== 'php://input' || $mode !== 'rb') return false;
        self::$opens++;
        return true;
    }
    public function stream_read(int $count): string {
        $bytes = substr(self::$body, $this->offset, $count);
        $this->offset += strlen($bytes);
        return $bytes;
    }
    public function stream_eof(): bool { return $this->offset >= strlen(self::$body); }
    public function stream_stat(): array { return []; }
}
S6TestInput::$body = $case['body'];
stream_wrapper_unregister('php');
stream_wrapper_register('php', S6TestInput::class);
$_SERVER = $case['server'];
$_GET = $case['query'];
register_shutdown_function(static function () use ($case): void {
    file_put_contents($case['resultFile'], json_encode([
        'status' => http_response_code() ?: 200, 'inputReads' => S6TestInput::$opens,
    ], JSON_THROW_ON_ERROR));
});
require $case['handler'];
