pipeline{

    agent any

    stages{

        stage('Checkout'){
            steps {
                checkout scm
            }
        }

        stage('Install frontend dependencies'){

            steps{
                bat 'npm install'
            }
        }

        stage('Build frontend'){
            steps{
                bat 'npm run build'
            }
        }
        stage('Install backend dependencies'){
            steps{
                dir('backend'){
                    bat 'python -m install -r requirements.txt'
                }
            }
        }
     }
// COMMENT
post{
    always {
        echo 'Pipeline execution completed'
    }

    success{
        echo 'Build completed successfully'
    }

    failure {
        echo 'Build failed. Check console for info'
    }
  }
}