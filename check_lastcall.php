#!/usr/bin/php -q 
<?php
if ($argc < 2) {
    die("Usage: php cdr_fetch.php <phone_number>\n");
}

// Get phone number from command line argument
$baseNumber = $argv[1];

// List of 5 servers
$servers = [
    "192.168.0.251",
    "192.168.0.252",
    "192.168.0.253",
    "192.168.0.247",
    "192.168.0.235"
];

// Generate URLs for each server with prefixes 9 and 8
$urls = [];
foreach ($servers as $server) {
    $urls[] = "http://$server:3000/cdr/9" . $baseNumber;
    $urls[] = "http://$server:3000/cdr/8" . $baseNumber;
    $urls[] = "http://$server:3000/cdr/7" . $baseNumber;
}

// Initialize cURL multi handle
$multiHandle = curl_multi_init();
$curlHandles = [];

// Create multiple cURL handles
foreach ($urls as $url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // Set a timeout for better performance
    $curlHandles[$url] = $ch;
    curl_multi_add_handle($multiHandle, $ch);
}

// Execute all queries simultaneously
$running = null;
do {
    curl_multi_exec($multiHandle, $running);
} while ($running > 0);

// Collect responses
$responses = [];
foreach ($curlHandles as $url => $ch) {
    $responses[$url] = curl_multi_getcontent($ch);
    curl_multi_remove_handle($multiHandle, $ch);
    curl_close($ch);
}

// Close multi handle
curl_multi_close($multiHandle);

// Print responses
foreach ($responses as $url => $response) {
    echo "Response from $url:$response\n";
}
?>

