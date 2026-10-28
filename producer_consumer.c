#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>
#include <semaphore.h>
#include <string.h>
#include <time.h>
#define BUFFER_SIZE 5
#define TOTAL_PACKETS 12

typedef struct {
    int id;
    char type[32];
} Packet;
Packet buffer[BUFFER_SIZE];
int count = 0;         
int in = 0, out = 0;
const char *packet_types[] = {
    "Temperature Data", "Atmospheric Data", "Image Data",
    "Location Data", "Pressure Data", "Camera Data", "Telemetry Data"
};
#ifndef UNSYNC
pthread_mutex_t mutex;
sem_t empty_sem;  
sem_t full_sem;    
#else
#endif
void log_event(const char *actor, const char *msg) {
    time_t now = time(NULL);
    struct tm *t = localtime(&now);
    printf("[%02d:%02d:%02d] %s: %s\n", t->tm_hour, t->tm_min, t->tm_sec, actor, msg);
}
void *satellite_producer(void *arg) {
    for (int i = 0; i < TOTAL_PACKETS; i++) {
        Packet p;
        p.id = i + 1;
        strncpy(p.type, packet_types[i % 7], sizeof(p.type));
        usleep(300000); 
#ifndef UNSYNC
        sem_wait(&empty_sem);          
        pthread_mutex_lock(&mutex);    
#else
        if (count >= BUFFER_SIZE) {
            printf("BUFFER FULL - Satellite waiting (busy-check, no real wait)\n");
            i--; usleep(200000); continue;
        }
#endif
        buffer[in] = p;
        in = (in + 1) % BUFFER_SIZE;
        count++;                       

        char msg[64];
        snprintf(msg, sizeof(msg), "produced Packet P%02d (%s) | count=%d", p.id, p.type, count);
        log_event("Satellite", msg);
#ifndef UNSYNC
        pthread_mutex_unlock(&mutex);  
        sem_post(&full_sem);        
#endif
    }
    return NULL;
}
void *ground_station_consumer(void *arg) {
    for (int i = 0; i < TOTAL_PACKETS; i++) {
        usleep(450000); 
#ifndef UNSYNC
        sem_wait(&full_sem);           
        pthread_mutex_lock(&mutex);    
#else
        if (count <= 0) {
            printf("BUFFER EMPTY - Ground Station waiting (busy-check, no real wait)\n");
            i--; usleep(200000); continue;
        }
#endif
        Packet p = buffer[out];
        out = (out + 1) % BUFFER_SIZE;
        count--;                       

        char msg[64];
        snprintf(msg, sizeof(msg), "consumed Packet P%02d (%s) | count=%d", p.id, p.type, count);
        log_event("Ground Station", msg);
#ifndef UNSYNC
        pthread_mutex_unlock(&mutex); 
        sem_post(&empty_sem);          
#endif
    }
    return NULL;
}
int main(void) {
    pthread_t sat_thread, gnd_thread;
#ifndef UNSYNC
    pthread_mutex_init(&mutex, NULL);
    sem_init(&empty_sem, 0, BUFFER_SIZE);
    sem_init(&full_sem, 0, 0);
    printf("=== SYNCHRONIZED Satellite <-> Ground Station simulation ===\n");
    printf("Using mutex + empty/full semaphores. Buffer size = %d\n\n", BUFFER_SIZE);
#else
    printf("=== UNSYNCHRONIZED Satellite <-> Ground Station simulation ===\n");
    printf("No mutex/semaphore protection. Race conditions on `count` are possible.\n");
    printf("Buffer size = %d\n\n", BUFFER_SIZE);
#endif
    pthread_create(&sat_thread, NULL, satellite_producer, NULL);
    pthread_create(&gnd_thread, NULL, ground_station_consumer, NULL);
    pthread_join(sat_thread, NULL);
    pthread_join(gnd_thread, NULL);

#ifndef UNSYNC
    pthread_mutex_destroy(&mutex);
    sem_destroy(&empty_sem);
    sem_destroy(&full_sem);
#endif
    printf("\nSimulation complete. Final count = %d (should be 0 if balanced and synchronized).\n", count);
    return 0;
}

