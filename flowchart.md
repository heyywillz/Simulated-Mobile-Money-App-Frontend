# Simulated Mobile Money Platform — System Flowcharts

This document provides visual flowcharts and architectural diagrams for the **AI-Based Mobile Money Fraud Detection System** (demonstrating **Account Takeover Detection [ATOD]** and **Transaction Anomaly Detection**).

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Clients["Client Surfaces"]
        WebClient["Web Client App<br/>(React + Tailwind)<br/>Port 5173"]
        MobileClient["Mobile Client App<br/>(React Native / Expo)<br/>Port 19006 / Expo"]
        AdminPortal["Fraud Admin Portal<br/>(React + Tailwind)<br/>Port 5174"]
    end

    subgraph Backend["Backend & Real-Time Sync (Port 3001)"]
        APIGateway["Express REST API<br/>/auth, /wallet, /admin"]
        SocketServer["Socket.io WebSocket Engine<br/>/sync (Users) & /admin/sync (SOC)"]
        FraudEngine["AI Fraud Scoring Engine<br/>(ATOD + Anomaly Analyzer)"]
        DBService["Database Service Layer<br/>(Prisma ORM Client)"]
    end

    subgraph Storage["Database Layer"]
        PostgresDB[("PostgreSQL Database<br/>momo_fraud_db<br/>Port 5432")]
    end

    WebClient <-->|"REST APIs & WebSockets"| APIGateway
    MobileClient <-->|"REST APIs & WebSockets"| APIGateway
    AdminPortal <-->|"Admin APIs & SOC Live Feed"| APIGateway

    APIGateway <--> SocketServer
    APIGateway --> FraudEngine
    APIGateway <--> DBService
    DBService <--> PostgresDB

    classDef client fill:#f0f9ff,stroke:#0284c7,stroke-width:2px;
    classDef backend fill:#fef2f2,stroke:#dc2626,stroke-width:2px;
    classDef storage fill:#f0fdf4,stroke:#16a34a,stroke-width:2px;
    class WebClient,MobileClient,AdminPortal client;
    class APIGateway,SocketServer,FraudEngine,DBService backend;
    class PostgresDB storage;
```

---

## 2. User Onboarding, Device Registration & Layered Login Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant App as Web / Mobile App
    participant API as Backend API
    participant DB as PostgreSQL DB

    User->>App: Enter Phone Number
    App->>API: POST /auth/request-otp { phoneNumber }
    API->>DB: Query User & verify status != frozen
    API-->>App: Simulated SMS OTP (e.g. 852433)
    
    User->>App: Enter Received OTP
    App->>API: POST /auth/login { phoneNumber, otp, deviceProfile, location }
    API->>API: Validate OTP & Generate JWT
    API->>DB: Register / Update Device & Session in DB
    API-->>App: JWT Token + User Profile + Active Sessions
    App->>App: Store Token & Connect to Socket.io (/sync)
```

---

## 3. Transaction Execution & AI Fraud Detection Decision Flow

```mermaid
flowchart TD
    Start(["User Submits Transaction<br/>(Amount, Receiver, Location, Device)"]) --> ValidateAuth{"Layer 1 Auth Passed?<br/>(MoMo PIN)"}
    
    ValidateAuth -- No --> RejectAuth["401 / 400 Rejected<br/>'Incorrect PIN / Auth Required'"]
    ValidateAuth -- Yes --> CheckBalance{"Sender Balance >= Amount?"}
    
    CheckBalance -- No --> RejectBalance["400 Rejected<br/>'Insufficient Balance'"]
    CheckBalance -- Yes --> IsOutgoing{"Is Outgoing Transfer?<br/>(Send / Cash Out)"}
    
    IsOutgoing -- No (Deposit/Cash In) --> CompleteImmediate["Status: Completed<br/>Update Balance in PostgreSQL"]
    IsOutgoing -- Yes --> FraudScoring["AI Fraud Evaluation Engine<br/>Analyze Transaction Context"]

    subgraph Evaluation["Fraud Scoring Signals"]
        FraudScoring --> S1["Check 1: Unregistered Device?<br/>(ATOD Signal: +0.70-0.95 score)"]
        FraudScoring --> S2["Check 2: Unfamiliar Geolocation?<br/>(ATOD Signal: +0.50-0.80 score)"]
        FraudScoring --> S3["Check 3: Amount > 2x Baseline?<br/>(Anomaly Signal: Ratio vs Historical Avg)"]
    end

    S1 & S2 & S3 --> ScoreAggregate{"Calculate Total Risk Score"}

    ScoreAggregate -- "Score == 0 (Normal)" --> CompleteImmediate
    ScoreAggregate -- "0.80 <= Score < 2.0 (Medium/High)" --> StepUpCheck{"Layer 2 Step-Up<br/>(Facial/Biometric Passed?)"}
    ScoreAggregate -- "Score >= 2.0 (Critical)" --> BlockTx["Status: BLOCKED<br/>Create Fraud Case in PostgreSQL"]

    StepUpCheck -- "Step-up Passed" --> CompleteImmediate
    StepUpCheck -- "Step-up Failed / Pending" --> FlagTx["Status: FLAGGED / UNDER REVIEW<br/>Create Fraud Case in PostgreSQL"]

    CompleteImmediate --> UpdateDB["Atomic Balance & Tx Update in PostgreSQL"]
    UpdateDB --> UserSocket["Emit Socket Event: 'balance:updated'<br/>Emit Socket Event: 'transaction:updated'"]

    FlagTx & BlockTx --> AdminSocket["Emit SOC Live Feed: 'admin:case:new'<br/>Notify Fraud Analyst"]

    classDef success fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef danger fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef warning fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    classDef process fill:#f1f5f9,stroke:#64748b,stroke-width:2px;

    class CompleteImmediate,UpdateDB success;
    class BlockTx,RejectAuth,RejectBalance danger;
    class FlagTx warning;
    class FraudScoring,S1,S2,S3,ScoreAggregate,StepUpCheck process;
```

---

## 4. Fraud Analyst Admin Portal (SOC) Workflow

```mermaid
flowchart TD
    AnalystLogin(["Analyst Logs In<br/>(kwame@momofraud.com)"]) --> AdminDashboard["Admin SOC Dashboard<br/>Live Queue & Analytics"]
    
    AdminDashboard --> FilterCases["Filter Cases By:<br/>- ATOD vs Transaction Anomaly<br/>- Risk Level: Critical / High / Medium<br/>- Status: Flagged / Under Review"]
    
    FilterCases --> ViewDetail["Open Case Detail View<br/>Compare Baseline Profile vs Current Attempt"]
    
    subgraph Comparison["Side-by-Side Context Review"]
        ViewDetail --> Comp1["Typical Range: GHS 10–500<br/>vs Attempt: GHS 1,400"]
        ViewDetail --> Comp2["Known Locations: Accra, Tema<br/>vs Location: Tamale"]
        ViewDetail --> Comp3["Known Devices: dev_001<br/>vs Device: unknown_device_99"]
    end

    Comp1 & Comp2 & Comp3 --> AnalystDecision{"Analyst Action Decision"}

    AnalystDecision -- "Approve Transaction" --> ActApprove["POST /admin/cases/:id/approve<br/>Update status = 'approved'"]
    AnalystDecision -- "Block Transaction" --> ActBlock["POST /admin/cases/:id/block<br/>Update status = 'blocked'"]
    AnalystDecision -- "Escalate Case" --> ActEscalate["POST /admin/cases/:id/escalate<br/>Assign Senior Reviewer"]
    AnalystDecision -- "Freeze User Account" --> ActFreeze["POST /admin/accounts/:id/freeze<br/>User status = 'frozen' in PostgreSQL"]

    ActApprove & ActBlock & ActEscalate & ActFreeze --> WriteAudit["Record Entry in PostgreSQL audit_logs table"]
    WriteAudit --> BroadcastAdmin["Broadcast Socket Update to Admin SOC & User Clients"]

    classDef action fill:#eff6ff,stroke:#2563eb,stroke-width:2px;
    classDef audit fill:#fdf4ff,stroke:#c026d3,stroke-width:2px;
    class ActApprove,ActBlock,ActEscalate,ActFreeze action;
    class WriteAudit,BroadcastAdmin audit;
```

---

## 5. PostgreSQL Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    users ||--o{ devices : "registers"
    users ||--o| behavior_profiles : "has baseline"
    users ||--o{ transactions : "sends / receives"
    users ||--o{ fraud_cases : "involved in"
    transactions ||--o| fraud_cases : "generates"

    users {
        string id PK
        string phoneNumber UK
        string fullName
        string email UK
        string password
        string role
        string status
        string pin
        int kycTier
        string ghanaCardId
        float balance
        string currency
        datetime createdAt
        datetime updatedAt
    }

    devices {
        string id PK
        string userId FK
        string deviceId UK
        string fingerprint
        string carrier
        string platform
        datetime lastSeenAt
        datetime registeredAt
    }

    behavior_profiles {
        string id PK
        string userId FK
        string[] knownLocations
        string[] typicalHours
        float avgTransactionAmount
        float typicalTransactionMin
        float typicalTransactionMax
    }

    transactions {
        string id PK
        string type
        float amount
        string currency
        string senderPhone
        string receiverPhone
        string receiverName
        string senderId FK
        string receiverId FK
        string status
        string reason
        string caseId
        float fraudScore
        string detectionType
        string riskLevel
        string cityName
        string regionName
        string countryName
        float latitude
        float longitude
        datetime createdAt
        datetime completedAt
    }

    fraud_cases {
        string id PK
        string transactionId FK
        string userId FK
        string detectionType
        string riskLevel
        string status
        json signals
        string assignedAnalyst
        string analystNotes
        datetime createdAt
        datetime updatedAt
    }

    audit_logs {
        string id PK
        string actor
        string action
        string target
        json details
        datetime timestamp
    }
```
