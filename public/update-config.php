<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Обработка preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Проверяем метод запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Получаем данные из запроса
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!isset($data['backendApiUrl']) || empty($data['backendApiUrl'])) {
    http_response_code(400);
    echo json_encode(['error' => 'backendApiUrl is required']);
    exit;
}

$backendApiUrl = trim($data['backendApiUrl']);

// Путь к файлу config.json в папке public
$configFile = __DIR__ . '/config.json';

// Создаем структуру конфига
$config = [
    'backendApiUrl' => $backendApiUrl
];

// Записываем в файл
$result = file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write config file']);
    exit;
}

// Возвращаем успешный ответ
echo json_encode([
    'success' => true,
    'message' => 'Config updated successfully',
    'backendApiUrl' => $backendApiUrl
]);
