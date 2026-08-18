pipeline {

    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install frontend dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Build frontend') {
            steps {
                bat 'npm run build'
            }
        }

        stage('Run frontend Tests') {
            steps {
                bat 'npm test'
            }
        }

        stage('Install backend dependencies') {
            steps {
                dir('backend') {
                    bat 'python -m pip install -r requirements.txt'
                }
            }
        }

      stage('Run Backend Tests') {
    steps {
        withCredentials([
            string(
                credentialsId: 'ai-interview-db-url',
                variable: 'DATABASE_URL'
            )
        ]) {
            dir('backend') {
                bat 'pytest'
            }
        }
    }
}

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'

                    withSonarQubeEnv('SonarQube') {
                        bat "\"${scannerHome}\\bin\\sonar-scanner.bat\""
                    }
                }
            }
        }
    stage('Deploy Frontend') {
    steps {
        bat 'deploy.bat'
    }
}
    
 stage('Deploy Backend') {
    steps {
        withCredentials([
            string(
                credentialsId: 'ai-interview-db-url',
                variable: 'DATABASE_URL'
            )
        ]) {
            bat 'start-backend.bat'
        }
    }
}   
    
    
    
    }

    post {
        always {
            echo 'Pipeline execution completed'
        }

        success {
            echo 'Build completed successfully'
        } 

        failure {
            echo 'Build failed. Check console for info'
        }
    }
}