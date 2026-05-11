#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiManager.h> // LIBRERÍA NUEVA: Gestiona el WiFi sin quemar las credenciales

// ---------------------------------------------------------
// Configuración del Broker MQTT
// ---------------------------------------------------------

// ---------------------------------------------------------
// Configuración del Broker MQTT
// ---------------------------------------------------------
// Reemplaza con la IP de la computadora donde corre Mosquitto (Docker)
const char* mqtt_server = "192.168.1.8"; 
const int mqtt_port = 1883;
const int pin_led = 2;

WiFiClient espClient;
PubSubClient client(espClient);

// Variables de temporización
unsigned long lastMsg = 0;

void flashLED(int iterations, int wait) {
  for (int i = 0; i < iterations; i++) {
    digitalWrite(pin_led, HIGH); // Encender
    delay(wait);
    digitalWrite(pin_led, LOW);  // Apagar
    delay(wait);
  }
}

void setup_wifi() {
  delay(10);
  Serial.println("\nInicializando WiFiManager...");

  // Inicialización de WiFiManager
  WiFiManager wifiManager;
  
  // Opcional: Descomenta la siguiente línea para borrar configuraciones guardadas previamente.
  // wifiManager.resetSettings();

  // Esto intentará conectarse a la red guardada.
  // Si no puede, crea un Access Point llamado "ESP32_Config"
  // Al cual te puedes conectar con el celular y configurar la red del evento.
  if (!wifiManager.autoConnect("ESP32_Config")) {
    Serial.println("Fallo al conectar, tiempo de espera agotado.");
    delay(3000);
    ESP.restart(); // Reiniciar si no logra conectar
  }

  // Si llegamos aquí, ya estamos conectados.
  Serial.println("");
  Serial.println("WiFi conectado exitosamente");
  Serial.print("Dirección IP: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
    Serial.print("Mensaje recibido [");
    Serial.print(topic);
    Serial.print("]: ");
    
    String messageTemp;
    for (int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
        messageTemp += (char)payload[i];
    }
    Serial.println();

    // Si se recibe un comando del backend
    if (String(topic) == "esp32/commands") {
        Serial.print("Comando recibido: ");
        Serial.println(messageTemp);
        // Aquí puedes hacer un JSON parse (usando ArduinoJson)
        // O hacer lógica simple: if(messageTemp.indexOf("turn_on") >= 0) { ... }
        }
}

void reconnect() {
    // Bucle hasta que estemos conectados
    while (!client.connected()) {
        Serial.print("Intentando conexión MQTT...");
        // Intentar conectar con un ID de cliente aleatorio
        String clientId = "ESP32Client-";
        clientId += String(random(0xffff), HEX);
        
        if (client.connect(clientId.c_str())) {
            Serial.println("conectado!");
            
            // Publicar estado una vez conectado
            client.publish("esp32/status", "{\"status\": \"online\"}");
            
            // Suscribirse al tópico de comandos
            client.subscribe("esp32/commands");
        } else {
            Serial.print("falló, rc=");
            Serial.print(client.state());
            Serial.println(" intentando de nuevo en 5 segundos");
            delay(5000);
        }
    }
}

void setup() {
    Serial.begin(115200);
    randomSeed(analogRead(0));
    
    pinMode(pin_led, OUTPUT);
    
    setup_wifi();
    
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callback);
}

void loop() {
    if (!client.connected()) {
        reconnect();
    }
    
    client.loop();

    // Publicar cada 5 segundos (telemetría simulada)
    unsigned long now = millis();
    if (now - lastMsg > 5000) {
        lastMsg = now;
        
        // Simular lectura de sensores
        float temp = 24.0 + random(0, 100) / 10.0;
        float hum = 50.0 + random(0, 200) / 10.0;
        
        // Crear JSON
        String payload = "{";
        payload += "\"temperatura\": " + String(temp, 2) + ",";
        payload += "\"humedad\": " + String(hum, 2);
        payload += "}";

        Serial.print("Publicando telemetría: ");
        Serial.println(payload);
        
        client.publish("esp32/telemetry", payload.c_str());
        
        flashLED(2, 500);
    }
}
